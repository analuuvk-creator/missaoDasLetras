import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3001;

let students = [];

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    message: "Servidor funcionando!",
  });
});

app.get("/api/students", (req, res) => {
  res.json(students);
});

app.post("/api/students", (req, res) => {
  students = req.body;

  console.log("Dados dos alunos atualizados.");

  res.json({
    ok: true,
    students,
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`http://localhost:${PORT}/api/status`);
  console.log("=================================");
});

server.on("error", (error) => {
  console.error("ERRO AO INICIAR O SERVIDOR:", error);
});