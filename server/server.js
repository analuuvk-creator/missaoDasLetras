import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3001;
const teacherUsername = process.env.TEACHER_USERNAME ?? "professor";
const teacherPassword = process.env.TEACHER_PASSWORD ?? "missao2026";
const teacherSessions = new Set();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const PORT = 3001;

// =========================================
// CONFIGURAÇÃO DO ARQUIVO DE DADOS
// =========================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, "students.json");

// =========================================
// CARREGAR ALUNOS
// =========================================

let students = [];

function loadStudents() {
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, "utf-8");

      if (data.trim()) {
        students = JSON.parse(data);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar alunos:", error);
    students = [];
  }
}

// =========================================
// SALVAR ALUNOS
// =========================================

function saveStudents() {
  try {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(students, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Erro ao salvar alunos:", error);
  }
}

loadStudents();

// =========================================
// STATUS DO SERVIDOR
// =========================================

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    message: "Servidor funcionando!",
  });
});

// =========================================
// BUSCAR TODOS OS ALUNOS
// =========================================

app.get("/api/students", (_req, res) => {
  res.json(students);
});

// =========================================
// ADICIONAR UM NOVO ALUNO
// =========================================

app.post("/api/students", (req, res) => {
  const student = req.body;

  if (!student || !student.name) {
    return res.status(400).json({
      ok: false,
      message: "Aluno inválido.",
    });
  }

  // O servidor cria o ID
  const newId =
    students.length > 0
      ? Math.max(...students.map((s) => Number(s.id) || 0)) + 1
      : 1;

  const newStudent = {
    ...student,
    id: newId,
  };

  students.push(newStudent);

  saveStudents();

  console.log(
    `Aluno adicionado: ${newStudent.name} ${newStudent.emoji || ""}`
  );

  res.status(201).json({
    ok: true,
    student: newStudent,
  });
});

// =========================================
// ATUALIZAR UM ALUNO
// =========================================

app.put("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = students.findIndex(
    (student) => Number(student.id) === id
  );

  if (index === -1) {
    return res.status(404).json({
      ok: false,
      message: "Aluno não encontrado.",
    });
  }

  students[index] = {
    ...students[index],
    ...req.body,
    id: students[index].id,
  };

  saveStudents();

  console.log(
    `Aluno atualizado: ${students[index].name}`
  );

  res.json({
    ok: true,
    student: students[index],
  });
});

// =========================================
// EXCLUIR UM ALUNO
// =========================================

app.delete("/api/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = students.findIndex(
    (student) => Number(student.id) === id
  );

  if (index === -1) {
    return res.status(404).json({
      ok: false,
      message: "Aluno não encontrado.",
    });
  }

  const removedStudent = students.splice(index, 1)[0];

  saveStudents();

  console.log(
    `Aluno removido: ${removedStudent.name}`
  );

  res.json({
    ok: true,
    student: removedStudent,
  });
});

// =========================================
// INICIAR SERVIDOR
// =========================================

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`http://localhost:${PORT}/api/status`);
  console.log("=================================");
});

server.on("error", (error) => {
  console.error(
    "ERRO AO INICIAR O SERVIDOR:",
    error
  );
});
