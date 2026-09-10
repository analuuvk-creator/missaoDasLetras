import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3001;

// Dados dos alunos ficam aqui enquanto o servidor estiver ligado
let students: any[] = [];

// Teste do servidor
app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    message: "Servidor funcionando!",
  });
});

// Buscar alunos
app.get("/api/students", (_req, res) => {
  res.json(students);
});

// Salvar alunos
app.post("/api/students", (req, res) => {
  students = req.body;

  console.log("Dados dos alunos atualizados.");

  res.json({
    ok: true,
    students,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor Express rodando na porta ${PORT}`);
  console.log(`Acesso local: http://localhost:${PORT}`);
});