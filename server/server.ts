import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = 3001;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const teacherUsername = process.env.TEACHER_USERNAME ?? "professor";
const teacherPassword = process.env.TEACHER_PASSWORD ?? "missao2026";
const teacherSessions = new Set<string>();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(projectRoot, "dist")));

const studentsFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "students.json");
const studentsSeedFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "students.seed.json");

function createStudentFromSeed(seed: any, index: number) {
  return {
    id: Number(seed.id) || index + 1,
    name: String(seed.name ?? "").trim().toUpperCase(),
    emoji: typeof seed.emoji === "string" && seed.emoji ? seed.emoji : "⭐",
    literacyLevel: 1,
    literacyStars: 0,
    literacyMissionsDone: 0,
    lastLiteracySondagem: null,
    mathLevel: 1,
    mathStars: 0,
    mathMissionsDone: 0,
    lastMathSondagem: null,
    sondagemHistory: [],
    skills: { letras: 0, silabas: 0, sons: 0, palavras: 0, escrita: 0 },
    attempts: 0,
    accuracy: 0,
    audioEnabled: true,
  };
}

function readSeedStudents(): any[] {
  try {
    const seed = JSON.parse(fs.readFileSync(studentsSeedFile, "utf8"));
    return Array.isArray(seed) ? seed : [];
  } catch {
    return [];
  }
}

function mergeSeedStudents(existing: any[]) {
  const existingNames = new Set(existing.map((student) => String(student.name ?? "").trim().toUpperCase()));
  let nextId = existing.reduce((max, student) => Math.max(max, Number(student.id) || 0), 0) + 1;
  const normalizedExisting = existing.map((student) => ({
    ...student,
    sondagemHistory: Array.isArray(student.sondagemHistory) ? student.sondagemHistory : [],
    lastLiteracySondagem: student.lastLiteracySondagem ?? null,
    lastMathSondagem: student.lastMathSondagem ?? null,
  }));
  const additions = readSeedStudents()
    .filter((seed) => {
      const name = String(seed.name ?? "").trim().toUpperCase();
      return name.length > 0 && !existingNames.has(name);
    })
    .map((seed, index) => {
      const student = createStudentFromSeed(seed, index);
      student.id = nextId++;
      existingNames.add(student.name);
      return student;
    });
  return additions.length > 0 ? [...normalizedExisting, ...additions] : normalizedExisting;
}

function loadStudents(): any[] {
  try {
    const data = JSON.parse(fs.readFileSync(studentsFile, "utf8"));
    if (Array.isArray(data) && data.length > 0) return mergeSeedStudents(data);
  } catch {
    // O arquivo persistido ainda não existe: carregar a lista inicial abaixo.
  }
  return readSeedStudents().map(createStudentFromSeed);
}

function saveStudents(data: any[]) {
  fs.writeFileSync(studentsFile, JSON.stringify(data, null, 2), "utf8");
}

let students: any[] = loadStudents();
if (students.length > 0) saveStudents(students);

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

app.post("/api/students/:id/sondagem", (req, res) => {
  const studentId = Number(req.params.id);
  const entry = req.body ?? {};
  const studentIndex = students.findIndex((student) => Number(student.id) === studentId);
  if (studentIndex < 0) {
    res.status(404).json({ ok: false, message: "Aluno não encontrado." });
    return;
  }
  if (!entry || !["literacy", "math"].includes(entry.area) || !Number.isFinite(Number(entry.level)) || !Number.isFinite(Number(entry.score)) || !Number.isFinite(Number(entry.total)) || !Array.isArray(entry.responses)) {
    res.status(400).json({ ok: false, message: "Dados inválidos da sondagem." });
    return;
  }
  const normalizedEntry = {
    date: typeof entry.date === "string" ? entry.date : new Date().toDateString(),
    area: entry.area,
    level: Number(entry.level),
    score: Number(entry.score),
    total: Number(entry.total),
    responses: entry.responses,
  };
  const student = students[studentIndex];
  students[studentIndex] = {
    ...student,
    lastLiteracySondagem: normalizedEntry.area === "literacy" ? normalizedEntry.date : student.lastLiteracySondagem,
    lastMathSondagem: normalizedEntry.area === "math" ? normalizedEntry.date : student.lastMathSondagem,
    sondagemHistory: [...(Array.isArray(student.sondagemHistory) ? student.sondagemHistory : []), normalizedEntry],
  };
  saveStudents(students);
  res.status(201).json({ ok: true, student: students[studentIndex], students });
});

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
  const newStudent = {
    ...student,
    id: students.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    name,
  };
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

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    res.sendFile(path.join(projectRoot, "dist", "index.html"));
    return;
  }
  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
  console.log(`Acesso local: http://localhost:${PORT}`);
});
