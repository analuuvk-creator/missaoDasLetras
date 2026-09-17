import express from "express";
import cors from "cors";
import crypto from "node:crypto";

const app = express();
const PORT = 3001;
const teacherUsername = process.env.TEACHER_USERNAME ?? "professor";
const teacherPassword = process.env.TEACHER_PASSWORD ?? "missao2026";
const teacherSessions = new Set<string>();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

let students: any[] = [];

function getSessionToken(req: express.Request) {
  const cookie = req.headers.cookie ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("teacher_session="))?.split("=")[1];
}

function requireTeacher(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getSessionToken(req);
  if (!token || !teacherSessions.has(token)) {
    res.status(401).json({ ok: false, message: "Acesso restrito ao professor." });
    return;
  }
  next();
}

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, message: "Servidor funcionando!" });
});

app.post("/api/teacher/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (username !== teacherUsername || password !== teacherPassword) {
    res.status(401).json({ ok: false, message: "Usuário ou senha inválidos." });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  teacherSessions.add(token);
  res.setHeader("Set-Cookie", `teacher_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
  res.json({ ok: true });
});

app.post("/api/teacher/logout", requireTeacher, (req, res) => {
  const token = getSessionToken(req);
  if (token) teacherSessions.delete(token);
  res.setHeader("Set-Cookie", "teacher_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/teacher/session", requireTeacher, (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/students", (_req, res) => {
  res.json(students);
});

app.post("/api/students", requireTeacher, (req, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ ok: false, message: "Formato inválido de alunos." });
    return;
  }
  students = req.body;
  console.log("Dados dos alunos atualizados.");
  res.json({ ok: true, students });
});

app.delete("/api/students/:id", requireTeacher, (req, res) => {
  const studentId = Number(req.params.id);
  const previousLength = students.length;
  students = students.filter((student) => Number(student.id) !== studentId);
  if (students.length === previousLength) {
    res.status(404).json({ ok: false, message: "Aluno não encontrado." });
    return;
  }
  res.json({ ok: true, students });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
  console.log(`Acesso local: http://localhost:${PORT}`);
});
