import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = 3001;
const teacherUsername = process.env.TEACHER_USERNAME ?? "professor";
const teacherPassword = process.env.TEACHER_PASSWORD ?? "missao2026";
const teacherSessions = new Set();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const studentsFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "students.json");

function loadStudents() {
  try {
    const data = JSON.parse(fs.readFileSync(studentsFile, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveStudents(data) {
  fs.writeFileSync(studentsFile, JSON.stringify(data, null, 2), "utf8");
}

let students = loadStudents();

function getSessionToken(req) {
  const cookie = req.headers.cookie ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("teacher_session="))?.split("=")[1];
}

function requireTeacher(req, res, next) {
  const token = getSessionToken(req);
  if (!token || !teacherSessions.has(token)) {
    res.status(401).json({ ok: false, message: "Acesso restrito ao professor." });
    return;
  }
  next();
}

app.get("/api/status", (_req, res) => res.json({ ok: true, message: "Servidor funcionando!" }));

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

app.get("/api/teacher/session", requireTeacher, (_req, res) => res.json({ ok: true }));
app.get("/api/students", (_req, res) => res.json(students));

app.post("/api/students/bootstrap", requireTeacher, (req, res) => {
  if (students.length === 0 && Array.isArray(req.body) && req.body.length > 0) {
    students = req.body;
    saveStudents(students);
  }
  res.json({ ok: true, students });
});

app.post("/api/students/add", requireTeacher, (req, res) => {
  const student = req.body ?? {};
  if (typeof student.name !== "string" || typeof student.emoji !== "string") {
    res.status(400).json({ ok: false, message: "Dados inválidos do aluno." });
    return;
  }
  const name = student.name.trim().toUpperCase();
  if (name.length < 2 || students.some((item) => item.name === name)) {
    res.status(409).json({ ok: false, message: "Já existe um aluno com esse nome." });
    return;
  }
  const newStudent = { ...student, id: students.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1, name };
  students = [...students, newStudent];
  saveStudents(students);
  res.status(201).json({ ok: true, students });
});

app.post("/api/students", requireTeacher, (req, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ ok: false, message: "Formato inválido de alunos." });
    return;
  }
  students = req.body;
  saveStudents(students);
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
  saveStudents(students);
  res.json({ ok: true, students });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`http://localhost:${PORT}/api/status`);
  console.log("=================================");
});

server.on("error", (error) => console.error("ERRO AO INICIAR O SERVIDOR:", error));
