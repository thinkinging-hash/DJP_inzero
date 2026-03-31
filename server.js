const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'daesaeng-secret-2026-change-in-production';

// ─── 디렉토리 초기화 ───────────────────────────────
// Render persistent disk 경로 자동 감지
const PERSISTENT_ROOT = process.env.RENDER_PERSISTENT_ROOT || (process.env.RENDER ? '/opt/render/project/src' : __dirname);
const UPLOADS_DIR = path.join(PERSISTENT_ROOT, 'uploads');
const DATA_DIR = path.join(PERSISTENT_ROOT, 'data');
[UPLOADS_DIR, DATA_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ─── 사용자 데이터 파일 ────────────────────────────
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function defaultUsers() {
  return [
    {
      id: 'admin',
      password: bcrypt.hashSync('todrhkrh!2', 10),
      name: '관리자',
      role: 'admin'
    },
    {
      id: 'sin',
      password: bcrypt.hashSync('123123', 10),
      name: 'sin',
      role: 'viewer'
    }
    {
      id: 'song',
      password: bcrypt.hashSync('123123', 10),
      name: 'song',
      role: 'viewer'
    }
  ];
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    const initial = defaultUsers();
    fs.writeFileSync(USERS_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  let changed = false;
  for (const baseUser of defaultUsers()) {
    if (!users.find(u => u.id === baseUser.id)) {
      users.push(baseUser);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  return users;
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ─── 엑셀 파일 경로 ────────────────────────────────
const EXCEL_META_FILE = path.join(DATA_DIR, 'excel_meta.json');

function getExcelMeta() {
  if (!fs.existsSync(EXCEL_META_FILE)) return null;
  return JSON.parse(fs.readFileSync(EXCEL_META_FILE, 'utf-8'));
}

function saveExcelMeta(meta) {
  fs.writeFileSync(EXCEL_META_FILE, JSON.stringify(meta, null, 2));
}

// ─── Multer 설정 ──────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    // 파일명 고정 (항상 최신으로 덮어씀)
    cb(null, 'dashboard.xlsx');
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') ||
                file.originalname.match(/\.(xlsx|xls)$/i);
    cb(null, ok ? null : new Error('엑셀 파일만 허용됩니다'));
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ─── 미들웨어 ─────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── JWT 인증 미들웨어 ────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해주세요' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '관리자만 접근 가능합니다' });
  next();
}

// ─── API: 로그인 ──────────────────────────────────
app.post('/api/login', (req, res) => {
  const { id, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.id === id);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
  res.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
});

// ─── API: 로그아웃 ────────────────────────────────
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ─── API: 현재 사용자 확인 ─────────────────────────
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ─── API: 엑셀 업로드 (관리자 전용) ──────────────────
app.post('/api/upload', authMiddleware, adminOnly, upload.single('excel'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });
  const meta = {
    filename: req.file.originalname,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user.name,
    size: req.file.size
  };
  saveExcelMeta(meta);
  res.json({ ok: true, meta });
});

// ─── API: 엑셀 파일 서빙 (인증 필요) ────────────────
app.get('/api/excel', authMiddleware, (req, res) => {
  const uploadedPath = path.join(UPLOADS_DIR, 'dashboard.xlsx');
  const bundledPath = path.join(__dirname, 'public', 'dashboard.xlsx');
  const filePath = fs.existsSync(uploadedPath) ? uploadedPath : bundledPath;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '엑셀 파일이 없습니다. 관리자에게 문의하세요.' });
  }
  res.sendFile(filePath);
});

// ─── API: 엑셀 메타 ───────────────────────────────
app.get('/api/excel-meta', authMiddleware, (req, res) => {
  const uploadedPath = path.join(UPLOADS_DIR, 'dashboard.xlsx');
  const bundledPath = path.join(__dirname, 'public', 'dashboard.xlsx');
  const meta = getExcelMeta();

  if (meta) return res.json({ meta, source: 'uploaded' });
  if (fs.existsSync(uploadedPath)) {
    const stat = fs.statSync(uploadedPath);
    return res.json({
      meta: {
        filename: 'dashboard.xlsx',
        uploadedAt: stat.mtime.toISOString(),
        uploadedBy: '관리자 업로드 파일',
        size: stat.size
      },
      source: 'uploaded'
    });
  }
  if (fs.existsSync(bundledPath)) {
    const stat = fs.statSync(bundledPath);
    return res.json({
      meta: {
        filename: 'dashboard.xlsx',
        uploadedAt: stat.mtime.toISOString(),
        uploadedBy: 'GitHub 기본 파일',
        size: stat.size
      },
      source: 'bundled'
    });
  }

  res.json({ meta: null, source: 'none' });
});

// ─── API: 사용자 목록 (관리자) ───────────────────────
app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers().map(u => ({ id: u.id, name: u.name, role: u.role }));
  res.json({ users });
});

// ─── API: 사용자 추가 (관리자) ───────────────────────
app.post('/api/users', authMiddleware, adminOnly, (req, res) => {
  const { id, password, name, role } = req.body;
  if (!id || !password || !name) return res.status(400).json({ error: '아이디, 비밀번호, 이름은 필수입니다' });
  const users = loadUsers();
  if (users.find(u => u.id === id)) return res.status(409).json({ error: '이미 존재하는 아이디입니다' });
  users.push({ id, password: bcrypt.hashSync(password, 10), name, role: role || 'viewer' });
  saveUsers(users);
  res.json({ ok: true });
});

// ─── API: 사용자 삭제 (관리자) ───────────────────────
app.delete('/api/users/:uid', authMiddleware, adminOnly, (req, res) => {
  if (req.params.uid === 'admin') return res.status(400).json({ error: '기본 관리자는 삭제할 수 없습니다' });
  let users = loadUsers();
  users = users.filter(u => u.id !== req.params.uid);
  saveUsers(users);
  res.json({ ok: true });
});

// ─── API: 비밀번호 변경 (관리자) ─────────────────────
app.put('/api/users/:uid/password', authMiddleware, adminOnly, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다' });
  const users = loadUsers();
  const user = users.find(u => u.id === req.params.uid);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
  user.password = bcrypt.hashSync(password, 10);
  saveUsers(users);
  res.json({ ok: true });
});

// ─── SPA 폴백 ─────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🏫 대생인재로 서버 실행 중: http://localhost:${PORT}`);
  loadUsers(); // 초기화
});
