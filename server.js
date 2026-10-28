const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.json());

// Menyajikan semua file statis (HTML, CSS, JS) langsung dari root directory
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  do { out = Array.from({length: 6}, () => chars[Math.floor(Math.random()*chars.length)]).join(''); }
  while (rooms.has(out));
  return out;
}
function getRoom(id) {
  return rooms.get(String(id || '').toUpperCase());
}
function snapshot(room) {
  return { id: room.id, question: room.question, active: room.active, answers: room.answers, count: room.answers.length };
}

app.post('/api/rooms', (req, res) => {
  const id = code();
  const room = { id, question: req.body?.question || 'Apa pendapat kalian?', active: true, answers: [], createdAt: Date.now() };
  rooms.set(id, room);
  res.json({ room: id });
});

app.get('/api/rooms/:id', async (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room tidak ditemukan' });
  const localIp = getLocalIp();
  let host = req.get('host') || `localhost:${PORT}`;

  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    host = host.replace(/^(localhost|127\.0\.0\.1)/, localIp);
  }

  const base = `${req.protocol}://${host}`;
  const joinUrl = `${base}/join.html?room=${room.id}`;
  const qr = await QRCode.toDataURL(joinUrl, { width: 360, margin: 2 });
  res.json({ ...snapshot(room), joinUrl, qr, localIp });
});

io.on('connection', socket => {
  socket.on('presenter:join', ({ room }) => {
    const r = getRoom(room); if (!r) return socket.emit('error:room', 'Room tidak ditemukan');
    socket.join(r.id); socket.data.role = 'presenter'; socket.data.room = r.id;
    socket.emit('room:state', snapshot(r));
  });

  socket.on('audience:join', ({ room, name }) => {
    const r = getRoom(room); if (!r) return socket.emit('error:room', 'Kode room salah atau sudah tidak tersedia');
    socket.join(r.id); socket.data.role = 'audience'; socket.data.room = r.id; socket.data.name = String(name || 'Anonim').slice(0, 40);
    socket.emit('room:state', snapshot(r));
    io.to(r.id).emit('audience:count', countAudience(r.id));
  });

  socket.on('presenter:setQuestion', ({ question }) => {
    const r = getRoom(socket.data.room); if (!r || socket.data.role !== 'presenter') return;
    r.question = String(question || '').trim().slice(0, 180) || 'Apa pendapat kalian?';
    r.answers = []; r.active = true;
    io.to(r.id).emit('room:state', snapshot(r));
  });

  socket.on('audience:answer', ({ text }) => {
    const r = getRoom(socket.data.room); if (!r || socket.data.role !== 'audience' || !r.active) return;
    const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!clean) return socket.emit('answer:error', 'Jawaban belum diisi.');
    if (r.answers.some(a => a.socketId === socket.id)) return socket.emit('answer:error', 'Kamu sudah mengirim jawaban.');
    r.answers.push({ text: clean, name: socket.data.name, socketId: socket.id, at: Date.now() });
    io.to(r.id).emit('answers:update', { answers: r.answers.map(({text,name,at}) => ({text,name,at})), count: r.answers.length });
    socket.emit('answer:ok');
  });

  socket.on('presenter:toggle', ({ active }) => {
    const r = getRoom(socket.data.room); if (!r || socket.data.role !== 'presenter') return;
    r.active = Boolean(active); io.to(r.id).emit('room:state', snapshot(r));
  });
  socket.on('presenter:clear', () => {
    const r = getRoom(socket.data.room); if (!r || socket.data.role !== 'presenter') return;
    r.answers = []; io.to(r.id).emit('answers:update', { answers: [], count: 0 });
  });
});

function countAudience(roomId) {
  let n = 0; for (const [, s] of io.sockets.sockets) if (s.data.room === roomId && s.data.role === 'audience') n++; return n;
}

setInterval(() => {
  const now = Date.now(); for (const [id, r] of rooms) if (now - r.createdAt > 6 * 60 * 60 * 1000) rooms.delete(id);
}, 60 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Live WordCloud running at:`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  console.log(`  - Network: http://${localIp}:${PORT}`);
});
