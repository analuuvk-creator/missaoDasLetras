import { useState, useEffect, useCallback, useRef } from "react";

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

type AppView = "avatar" | "area-select" | "sondagem-hub" | "sondagem" | "sondagem-result" | "game" | "feedback" | "teacher-login" | "teacher" | "profile" | "alphabet";
type Area = "literacy" | "math";
type GamePhase = "playing" | "wrong1" | "revealed";

interface Option { label: string; value: string; correct: boolean; }

interface Activity {
  instruction: string; spoken: string; tag: string; tagIcon: string;
  target?: string; image?: string; word?: string; mathDisplay?: string;
  options?: Option[]; type: "choice" | "write" | "spell";
  answers?: string[]; spellingRule?: SpellingRuleKey;
}

type SpellingRuleKey = "ss_rule" | "x_ch_rule" | "z_rule" | "accent_acute" | "accent_tilde" | "accent_circ" | "lh_nh_rule";

interface SondagemResponse { spoken: string; written: string; correct: boolean; }
interface SondagemEntry { date: string; area: Area; level: number; score: number; total: number; responses: SondagemResponse[]; }

interface TeacherNotification {
  id: number; studentId: number; studentName: string; studentEmoji: string;
  area: Area; level: number; levelName: string; date: string; read: boolean;
  direction?: "up" | "down" | "complete";
}

interface Student {
  id: number; name: string; emoji: string;
  literacyLevel: number; literacyStars: number; literacyMissionsDone: number; lastLiteracySondagem: string | null;
  mathLevel: number; mathStars: number; mathMissionsDone: number; lastMathSondagem: string | null;
  sondagemHistory: SondagemEntry[];
  skills: { letras: number; silabas: number; sons: number; palavras: number; escrita: number };
  attempts: number; accuracy: number;
  audioEnabled: boolean;
}

// ════════════════════════════════════════════════════════════════
// SPEECH
// ════════════════════════════════════════════════════════════════

function speak(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "pt-BR"; utt.rate = 0.78; utt.pitch = 1.1;
  if (onEnd) utt.onend = onEnd;
  const pt = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("pt"));
  if (pt) utt.voice = pt;
  window.speechSynthesis.speak(utt);
}
const stopSpeech = () => window.speechSynthesis?.cancel();

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

const MISSIONS_REQUIRED = 5;
const LITERACY_MAX_LEVEL = 9;
const MATH_MAX_LEVEL = 8;
const AUDIO_LITERACY_MAX = 5;

function today(): string { return new Date().toDateString(); }
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ════════════════════════════════════════════════════════════════
// METADATA
// ════════════════════════════════════════════════════════════════

const LIT_META: Record<number, { name: string; bg: string; solid: string; pastelBg: string; pastelBorder: string; pastelText: string; badge: string; text: string; prog: string; mascot: string }> = {
  1: { name:"GARATUJA",              bg:"from-rose-400 to-orange-400",    solid:"#f97316", pastelBg:"#fff1f2", pastelBorder:"#fda4af", pastelText:"#be185d", badge:"bg-rose-100 text-rose-700",      text:"text-rose-600",   prog:"bg-rose-400",   mascot:"🌱" },
  2: { name:"PRÉ-SILÁBICO",         bg:"from-amber-400 to-yellow-400",   solid:"#f59e0b", pastelBg:"#fffbeb", pastelBorder:"#fde68a", pastelText:"#b45309", badge:"bg-amber-100 text-amber-700",    text:"text-amber-600", prog:"bg-amber-400",  mascot:"🐣" },
  3: { name:"SILÁBICO SEM VALOR",   bg:"from-lime-400 to-emerald-400",   solid:"#22c55e", pastelBg:"#f0fdf4", pastelBorder:"#86efac", pastelText:"#15803d", badge:"bg-green-100 text-green-700",    text:"text-green-700", prog:"bg-green-400",  mascot:"🐛" },
  4: { name:"SILÁBICO COM VALOR",   bg:"from-teal-400 to-cyan-500",      solid:"#06b6d4", pastelBg:"#f0fdfa", pastelBorder:"#5eead4", pastelText:"#0f766e", badge:"bg-teal-100 text-teal-700",     text:"text-teal-600",  prog:"bg-teal-400",   mascot:"🦋" },
  5: { name:"SILÁBICO-ALFABÉTICO",  bg:"from-blue-500 to-indigo-500",    solid:"#6366f1", pastelBg:"#eff6ff", pastelBorder:"#93c5fd", pastelText:"#1d4ed8", badge:"bg-blue-100 text-blue-700",     text:"text-blue-600",  prog:"bg-blue-500",   mascot:"🚀" },
  6: { name:"ALFABÉTICO INICIAL",   bg:"from-violet-500 to-purple-600",  solid:"#7c3aed", pastelBg:"#faf5ff", pastelBorder:"#c4b5fd", pastelText:"#6d28d9", badge:"bg-violet-100 text-violet-700", text:"text-violet-600",prog:"bg-violet-500", mascot:"🏆" },
  7: { name:"ALFABÉTICO AVANÇADO",  bg:"from-fuchsia-500 to-pink-500",   solid:"#d946ef", pastelBg:"#fdf4ff", pastelBorder:"#e879f9", pastelText:"#a21caf", badge:"bg-fuchsia-100 text-fuchsia-700",text:"text-fuchsia-600",prog:"bg-fuchsia-500",mascot:"📚" },
  8: { name:"FLUÊNCIA INICIAL",     bg:"from-pink-400 to-rose-500",      solid:"#ec4899", pastelBg:"#fdf2f8", pastelBorder:"#f9a8d4", pastelText:"#be185d", badge:"bg-pink-100 text-pink-700",     text:"text-pink-600",  prog:"bg-pink-400",   mascot:"📖" },
  9: { name:"FLUÊNCIA AVANÇADA",    bg:"from-red-500 to-rose-600",       solid:"#ef4444", pastelBg:"#fef2f2", pastelBorder:"#fca5a5", pastelText:"#b91c1c", badge:"bg-red-100 text-red-700",       text:"text-red-600",   prog:"bg-red-400",    mascot:"🎓" },
};

const MATH_META: Record<number, { name: string; bg: string; solid: string; pastelBg: string; pastelBorder: string; pastelText: string; badge: string; text: string; prog: string; mascot: string }> = {
  1: { name:"CONTAGEM ATÉ 5",         bg:"from-sky-400 to-cyan-400",       solid:"#38bdf8", pastelBg:"#f0f9ff", pastelBorder:"#7dd3fc", pastelText:"#0369a1", badge:"bg-sky-100 text-sky-700",       text:"text-sky-600",    prog:"bg-sky-400",    mascot:"🐥" },
  2: { name:"CONTAGEM ATÉ 20",        bg:"from-cyan-500 to-teal-500",      solid:"#14b8a6", pastelBg:"#f0fdfa", pastelBorder:"#5eead4", pastelText:"#0f766e", badge:"bg-cyan-100 text-cyan-700",     text:"text-cyan-600",   prog:"bg-cyan-500",   mascot:"🦔" },
  3: { name:"ADIÇÃO ATÉ 10",          bg:"from-emerald-400 to-green-500",  solid:"#22c55e", pastelBg:"#f0fdf4", pastelBorder:"#86efac", pastelText:"#15803d", badge:"bg-emerald-100 text-emerald-700",text:"text-emerald-600",prog:"bg-emerald-400",mascot:"🐸" },
  4: { name:"SUBTRAÇÃO ATÉ 10",       bg:"from-orange-400 to-red-400",     solid:"#f97316", pastelBg:"#fff7ed", pastelBorder:"#fed7aa", pastelText:"#c2410c", badge:"bg-orange-100 text-orange-700", text:"text-orange-600", prog:"bg-orange-400", mascot:"🦁" },
  5: { name:"ADIÇÃO ATÉ 20",          bg:"from-blue-500 to-indigo-500",    solid:"#6366f1", pastelBg:"#eff6ff", pastelBorder:"#93c5fd", pastelText:"#1d4ed8", badge:"bg-blue-100 text-blue-700",     text:"text-blue-600",   prog:"bg-blue-500",   mascot:"🦊" },
  6: { name:"SUBTRAÇÃO ATÉ 20",       bg:"from-violet-400 to-indigo-500",  solid:"#7c3aed", pastelBg:"#faf5ff", pastelBorder:"#c4b5fd", pastelText:"#6d28d9", badge:"bg-violet-100 text-violet-700", text:"text-violet-600", prog:"bg-violet-400", mascot:"🦸" },
  7: { name:"MULTIPLICAÇÃO",           bg:"from-fuchsia-500 to-pink-500",   solid:"#d946ef", pastelBg:"#fdf4ff", pastelBorder:"#e879f9", pastelText:"#a21caf", badge:"bg-fuchsia-100 text-fuchsia-700",text:"text-fuchsia-600",prog:"bg-fuchsia-500",mascot:"🧮" },
  8: { name:"RESOLUÇÃO DE PROBLEMAS", bg:"from-amber-500 to-orange-500",   solid:"#f59e0b", pastelBg:"#fffbeb", pastelBorder:"#fde68a", pastelText:"#b45309", badge:"bg-amber-100 text-amber-700",   text:"text-amber-600",  prog:"bg-amber-500",  mascot:"🏅" },
};

// ════════════════════════════════════════════════════════════════
// ALPHABET
// ════════════════════════════════════════════════════════════════

const ALPHABET_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LETTER_PHONEMES: Record<string, string> = {
  A:"á",B:"bê",C:"cê",D:"dê",E:"é",F:"éfe",G:"gê",H:"agá",I:"í",J:"jota",
  K:"cá",L:"éle",M:"ême",N:"êne",O:"ó",P:"pê",Q:"quê",R:"érre",S:"ésse",
  T:"tê",U:"u",V:"vê",W:"dáblio",X:"xis",Y:"ípsilon",Z:"zê"
};

const ALPHABET_MISSING: { sequence: string[]; answer: string; options: string[] }[] = [
  { sequence:["A","B","_","D","E"], answer:"C", options:["C","F","G"] },
  { sequence:["F","G","H","_","J"], answer:"I", options:["A","I","K"] },
  { sequence:["K","_","M","N","O"], answer:"L", options:["L","P","E"] },
  { sequence:["P","Q","_","S","T"], answer:"R", options:["R","U","B"] },
  { sequence:["U","V","W","_","Y"], answer:"X", options:["X","Z","D"] },
  { sequence:["_","B","C","D","E"], answer:"A", options:["A","F","H"] },
  { sequence:["V","W","X","Y","_"], answer:"Z", options:["Z","A","M"] },
  { sequence:["H","I","J","_","L"], answer:"K", options:["K","N","O"] },
  { sequence:["M","N","_","P","Q"], answer:"O", options:["O","R","S"] },
  { sequence:["R","S","_","U","V"], answer:"T", options:["T","W","X"] },
  { sequence:["C","D","_","F","G"], answer:"E", options:["E","H","I"] },
  { sequence:["N","_","P","Q","R"], answer:"O", options:["O","M","S"] },
];

const ALPHABET_ANAGRAMS: { word: string; hint: string }[] = [
  { word:"GATO",      hint:"🐱 ANIMAL" },
  { word:"BOLA",      hint:"⚽ BRINQUEDO" },
  { word:"CASA",      hint:"🏠 LUGAR" },
  { word:"PATO",      hint:"🐦 ANIMAL" },
  { word:"MALA",      hint:"🧳 OBJETO" },
  { word:"SAPO",      hint:"🐸 ANIMAL" },
  { word:"LOBO",      hint:"🐺 ANIMAL" },
  { word:"NAVIO",     hint:"🚢 VEÍCULO" },
  { word:"LIVRO",     hint:"📚 OBJETO" },
  { word:"PORTA",     hint:"🚪 OBJETO" },
  { word:"PEIXE",     hint:"🐟 ANIMAL" },
  { word:"PEDRA",     hint:"🪨 OBJETO" },
  { word:"FOLHA",     hint:"🍃 NATUREZA" },
  { word:"COBRA",     hint:"🐍 ANIMAL" },
  { word:"FLOR",      hint:"🌸 NATUREZA" },
];

// ════════════════════════════════════════════════════════════════
// SPELLING RULES
// ════════════════════════════════════════════════════════════════

const SPELLING_RULES: Record<SpellingRuleKey, { title: string; icon: string; color: string; tc: string; rule: string; examples: string }> = {
  ss_rule:      { title:"A REGRA DO SS",    icon:"📝", color:"bg-blue-50 border-blue-200",    tc:"text-blue-700",   rule:"ENTRE DUAS VOGAIS, O SOM DE S É ESCRITO COM SS!",                 examples:"PASSO · MASSA · OSSO · GROSSO" },
  x_ch_rule:    { title:"X OU CH?",         icon:"🤔", color:"bg-purple-50 border-purple-200", tc:"text-purple-700", rule:"O SOM DE X PODE SER ESCRITO COM X OU COM CH!",                   examples:"CAIXA · CHAVE · XÍCARA · FICHA" },
  z_rule:       { title:"A REGRA DO Z",      icon:"🔤", color:"bg-green-50 border-green-200",  tc:"text-green-700",  rule:"O SOM DE Z ENTRE VOGAIS É ESCRITO COM Z!",                       examples:"FAZER · BUZINA · AZUL · DOZE" },
  accent_acute: { title:"O ACENTO AGUDO",    icon:"´",  color:"bg-amber-50 border-amber-200",  tc:"text-amber-700",  rule:"O ACENTO AGUDO INDICA QUE A SÍLABA É FORTE E A VOGAL É ABERTA.", examples:"PÁSSARO · CAFÉ · ÍNDIO · ÓCULOS" },
  accent_tilde: { title:"O TIL",             icon:"~",  color:"bg-rose-50 border-rose-200",    tc:"text-rose-700",   rule:"O TIL INDICA QUE A VOGAL TEM SOM NASAL.",                        examples:"MÃO · PÃO · IRMÃO · LIMÃO" },
  accent_circ:  { title:"O CIRCUNFLEXO",     icon:"^",  color:"bg-indigo-50 border-indigo-200",tc:"text-indigo-700", rule:"O CIRCUNFLEXO INDICA QUE A SÍLABA É FORTE E A VOGAL É FECHADA.", examples:"ÂNCORA · VOCÊ · AVÔ · ÊNFASE" },
  lh_nh_rule:   { title:"LH E NH",           icon:"🔡", color:"bg-teal-50 border-teal-200",    tc:"text-teal-700",   rule:"LH E NH SÃO DÍGRAFOS: DUAS LETRAS QUE FAZEM UM ÚNICO SOM!",      examples:"FILHO · OLHO · LINHA · NINHO" },
};

// ════════════════════════════════════════════════════════════════
// LITERACY ACTIVITIES — 9 levels
// ════════════════════════════════════════════════════════════════

const LITERACY_ACTIVITIES: Record<number, Activity[]> = {
  1: [
    { tag:"LETRA",  tagIcon:"🔤", instruction:"TOQUE NA LETRA", spoken:"Toque na letra A.", target:"A", options:[{label:"A",value:"A",correct:true},{label:"5",value:"5",correct:false},{label:"★",value:"★",correct:false},{label:"B",value:"B",correct:false}], type:"choice" },
    { tag:"NÚMERO", tagIcon:"🔢", instruction:"QUAL É UM NÚMERO?", spoken:"Qual desses é um número?", options:[{label:"3",value:"3",correct:true},{label:"A",value:"A",correct:false},{label:"★",value:"★",correct:false}], type:"choice" },
    { tag:"LETRA",  tagIcon:"🔤", instruction:"ENCONTRE A LETRA IGUAL A", spoken:"Encontre a letra igual a B.", target:"B", options:[{label:"D",value:"D",correct:false},{label:"B",value:"B",correct:true},{label:"P",value:"P",correct:false},{label:"R",value:"R",correct:false}], type:"choice" },
    { tag:"IMAGEM", tagIcon:"🖼️", instruction:"TOQUE NA IMAGEM DA BOLA", spoken:"Toque na imagem da bola.", options:[{label:"🎈",value:"balão",correct:false},{label:"⚽",value:"bola",correct:true},{label:"🍎",value:"maçã",correct:false}], type:"choice" },
    { tag:"LETRA",  tagIcon:"🔤", instruction:"TOQUE NA LETRA M", spoken:"Toque na letra M.", target:"M", options:[{label:"N",value:"N",correct:false},{label:"H",value:"H",correct:false},{label:"M",value:"M",correct:true}], type:"choice" },
    { tag:"IMAGEM", tagIcon:"🖼️", instruction:"TOQUE NA IMAGEM DO GATO", spoken:"Toque na imagem do gato.", options:[{label:"🐱",value:"gato",correct:true},{label:"🐶",value:"cachorro",correct:false},{label:"🐸",value:"sapo",correct:false}], type:"choice" },
    { tag:"LETRA",  tagIcon:"🔤", instruction:"QUAL É UMA LETRA?", spoken:"Qual desses é uma letra?", options:[{label:"7",value:"7",correct:false},{label:"E",value:"E",correct:true},{label:"★",value:"★",correct:false}], type:"choice" },
    { tag:"IMAGEM", tagIcon:"🖼️", instruction:"TOQUE NA IMAGEM DO SOL", spoken:"Toque na imagem do sol.", options:[{label:"⭐",value:"estrela",correct:false},{label:"🌙",value:"lua",correct:false},{label:"☀️",value:"sol",correct:true}], type:"choice" },
    { tag:"LETRA",  tagIcon:"🔤", instruction:"TOQUE NA LETRA O", spoken:"Toque na letra O.", target:"O", options:[{label:"0",value:"0",correct:false},{label:"Q",value:"Q",correct:false},{label:"O",value:"O",correct:true}], type:"choice" },
    { tag:"LETRA",  tagIcon:"🔤", instruction:"TOQUE NA LETRA S", spoken:"Toque na letra S.", target:"S", options:[{label:"S",value:"S",correct:true},{label:"5",value:"5",correct:false},{label:"Z",value:"Z",correct:false}], type:"choice" },
  ],
  2: [
    { tag:"PALAVRA", tagIcon:"📖", instruction:"QUAL PALAVRA COMBINA COM A IMAGEM?", spoken:"Qual palavra combina com a imagem do gato?", image:"🐱", options:[{label:"GATO",value:"GATO",correct:true},{label:"BOLA",value:"BOLA",correct:false},{label:"CASA",value:"CASA",correct:false}], type:"choice" },
    { tag:"PALAVRA", tagIcon:"📖", instruction:"QUAL PALAVRA COMBINA COM A IMAGEM?", spoken:"Qual palavra combina com a imagem da casa?", image:"🏠", options:[{label:"RATO",value:"RATO",correct:false},{label:"MALA",value:"MALA",correct:false},{label:"CASA",value:"CASA",correct:true}], type:"choice" },
    { tag:"LETRA",   tagIcon:"🔤", instruction:"QUAL É A PRIMEIRA LETRA DE", spoken:"Qual é a primeira letra da palavra PATO?", word:"PATO?", options:[{label:"P",value:"P",correct:true},{label:"B",value:"B",correct:false},{label:"M",value:"M",correct:false}], type:"choice" },
    { tag:"RIMA",    tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com GATO?", word:"GATO?", options:[{label:"PATO",value:"PATO",correct:true},{label:"BOLA",value:"BOLA",correct:false},{label:"MESA",value:"MESA",correct:false}], type:"choice" },
    { tag:"RIMA",    tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com BOLA?", word:"BOLA?", options:[{label:"CASA",value:"CASA",correct:false},{label:"ESCOLA",value:"ESCOLA",correct:true},{label:"DEDO",value:"DEDO",correct:false}], type:"choice" },
    { tag:"PALAVRA", tagIcon:"📖", instruction:"QUAL PALAVRA TEM MAIS LETRAS?", spoken:"Qual das palavras tem mais letras?", options:[{label:"SOL",value:"SOL",correct:false},{label:"BORBOLETA",value:"BORBOLETA",correct:true},{label:"PÁ",value:"PÁ",correct:false}], type:"choice" },
    { tag:"LETRA",   tagIcon:"🔤", instruction:"QUAL É A PRIMEIRA LETRA DE", spoken:"Qual é a primeira letra da palavra MALA?", word:"MALA?", options:[{label:"N",value:"N",correct:false},{label:"M",value:"M",correct:true},{label:"B",value:"B",correct:false}], type:"choice" },
    { tag:"PALAVRA", tagIcon:"📖", instruction:"QUAL PALAVRA COMBINA COM A IMAGEM?", spoken:"Qual palavra combina com a imagem do sapo?", image:"🐸", options:[{label:"GATO",value:"GATO",correct:false},{label:"SAPO",value:"SAPO",correct:true},{label:"PATO",value:"PATO",correct:false}], type:"choice" },
    { tag:"RIMA",    tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com PATO?", word:"PATO?", options:[{label:"MATO",value:"MATO",correct:true},{label:"BOLA",value:"BOLA",correct:false},{label:"MESA",value:"MESA",correct:false}], type:"choice" },
    { tag:"RIMA",    tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com SOL?", word:"SOL?", options:[{label:"FAROL",value:"FAROL",correct:true},{label:"GATO",value:"GATO",correct:false},{label:"BOLA",value:"BOLA",correct:false}], type:"choice" },
  ],
  3: [
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUAL É A PRIMEIRA PARTE DA PALAVRA", spoken:"Qual é a primeira parte da palavra BOLA?", word:"BOLA?", options:[{label:"BO",value:"BO",correct:true},{label:"CA",value:"CA",correct:false},{label:"MA",value:"MA",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUANTAS PARTES TEM A PALAVRA", spoken:"Quantas partes tem a palavra GATO?", word:"GATO?", options:[{label:"1",value:"1",correct:false},{label:"2",value:"2",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUAL É A PRIMEIRA PARTE DA PALAVRA", spoken:"Qual é a primeira parte da palavra MALA?", word:"MALA?", options:[{label:"MA",value:"MA",correct:true},{label:"LA",value:"LA",correct:false},{label:"BO",value:"BO",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUANTAS PARTES TEM A PALAVRA", spoken:"Quantas partes tem a palavra BORBOLETA?", word:"BORBOLETA?", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true}], type:"choice" },
    { tag:"RIMA",   tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com MALA?", word:"MALA?", options:[{label:"FALA",value:"FALA",correct:true},{label:"GATO",value:"GATO",correct:false},{label:"BOLO",value:"BOLO",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUAL É A ÚLTIMA PARTE DA PALAVRA", spoken:"Qual é a última parte da palavra PATO?", word:"PATO?", options:[{label:"PA",value:"PA",correct:false},{label:"TO",value:"TO",correct:true},{label:"BO",value:"BO",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUAL É A PRIMEIRA PARTE DA PALAVRA", spoken:"Qual é a primeira parte da palavra CAMA?", word:"CAMA?", options:[{label:"CA",value:"CA",correct:true},{label:"MA",value:"MA",correct:false},{label:"NA",value:"NA",correct:false}], type:"choice" },
    { tag:"RIMA",   tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com CAMA?", word:"CAMA?", options:[{label:"FAMA",value:"FAMA",correct:true},{label:"PATO",value:"PATO",correct:false},{label:"MESA",value:"MESA",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUANTAS PARTES TEM A PALAVRA", spoken:"Quantas partes tem a palavra BOLA?", word:"BOLA?", options:[{label:"1",value:"1",correct:false},{label:"2",value:"2",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
    { tag:"SÍLABA", tagIcon:"📚", instruction:"QUANTAS PARTES TEM A PALAVRA", spoken:"Quantas partes tem a palavra MACARRÃO?", word:"MACARRÃO?", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true},{label:"5",value:"5",correct:false}], type:"choice" },
  ],
  4: [
    { tag:"SOM",  tagIcon:"🔊", instruction:'QUAL COMEÇA COM O SOM "BO"?', spoken:"Qual imagem começa com o som BO?", options:[{label:"🐱",value:"gato",correct:false},{label:"⚽",value:"bola",correct:true},{label:"🏠",value:"casa",correct:false}], type:"choice" },
    { tag:"SOM",  tagIcon:"🔊", instruction:'QUAL PALAVRA COMEÇA IGUAL A "BOLA"?', spoken:"Qual palavra começa com o mesmo som de BOLA?", options:[{label:"CAMA",value:"CAMA",correct:false},{label:"BOLO",value:"BOLO",correct:true},{label:"PATO",value:"PATO",correct:false}], type:"choice" },
    { tag:"SOM",  tagIcon:"🔊", instruction:'QUAL COMEÇA COM O SOM "MA"?', spoken:"Qual imagem começa com o som MA?", options:[{label:"🍎",value:"maçã",correct:true},{label:"🐶",value:"cachorro",correct:false},{label:"🌊",value:"onda",correct:false}], type:"choice" },
    { tag:"RIMA", tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com PÃO?", word:"PÃO?", options:[{label:"MÃO",value:"MÃO",correct:true},{label:"BOLO",value:"BOLO",correct:false},{label:"DEDO",value:"DEDO",correct:false}], type:"choice" },
    { tag:"SOM",  tagIcon:"🔊", instruction:"QUAL LETRA FAZ O SOM", spoken:"Qual letra faz o som M?", word:'"M"?', options:[{label:"N",value:"N",correct:false},{label:"B",value:"B",correct:false},{label:"M",value:"M",correct:true}], type:"choice" },
    { tag:"RIMA", tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com FLOR?", word:"FLOR?", options:[{label:"COR",value:"COR",correct:true},{label:"BOLA",value:"BOLA",correct:false},{label:"CASA",value:"CASA",correct:false}], type:"choice" },
    { tag:"SOM",  tagIcon:"🔊", instruction:'QUAL COMEÇA COM O SOM "PE"?', spoken:"Qual imagem começa com o som PE?", options:[{label:"⚽",value:"bola",correct:false},{label:"🐟",value:"peixe",correct:true},{label:"🏠",value:"casa",correct:false}], type:"choice" },
    { tag:"RIMA", tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com MEL?", word:"MEL?", options:[{label:"PAPEL",value:"PAPEL",correct:true},{label:"GATO",value:"GATO",correct:false},{label:"BOLA",value:"BOLA",correct:false}], type:"choice" },
    { tag:"SOM",  tagIcon:"🔊", instruction:'QUAL COMEÇA COM O SOM "CA"?', spoken:"Qual imagem começa com o som CA?", options:[{label:"🍌",value:"banana",correct:false},{label:"🏠",value:"casa",correct:true},{label:"🐶",value:"cachorro",correct:false}], type:"choice" },
    { tag:"RIMA", tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com BOLO?", word:"BOLO?", options:[{label:"TIJOLO",value:"TIJOLO",correct:true},{label:"PORTA",value:"PORTA",correct:false},{label:"MESA",value:"MESA",correct:false}], type:"choice" },
  ],
  5: [
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"COMPLETE A PALAVRA:", spoken:"Complete a palavra: BO... L... A.", word:"BO _ A", image:"⚽", options:[{label:"L",value:"L",correct:true},{label:"M",value:"M",correct:false},{label:"T",value:"T",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"QUAL LETRA FALTA?", spoken:"Qual letra falta em GA...O?", word:"GA _ O", image:"🐱", options:[{label:"T",value:"T",correct:true},{label:"P",value:"P",correct:false},{label:"L",value:"L",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"COMPLETE A PALAVRA:", spoken:"Complete a palavra: CA...A.", word:"CA _ A", image:"🏠", options:[{label:"S",value:"S",correct:true},{label:"B",value:"B",correct:false},{label:"R",value:"R",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"QUAL LETRA FALTA?", spoken:"Qual letra falta em PA...O?", word:"PA _ O", image:"🐦", options:[{label:"T",value:"T",correct:true},{label:"S",value:"S",correct:false},{label:"L",value:"L",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"QUAL LETRA FALTA?", spoken:"Qual letra falta em ME...A?", word:"ME _ A", image:"🪑", options:[{label:"S",value:"S",correct:true},{label:"T",value:"T",correct:false},{label:"R",value:"R",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"QUAL LETRA FALTA?", spoken:"Qual letra falta em FA...A?", word:"FA _ A", image:"💬", options:[{label:"L",value:"L",correct:true},{label:"M",value:"M",correct:false},{label:"T",value:"T",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"COMPLETE A PALAVRA:", spoken:"Complete a palavra: SO...Á.", word:"SO _ Á", image:"🛋️", options:[{label:"F",value:"F",correct:true},{label:"P",value:"P",correct:false},{label:"B",value:"B",correct:false}], type:"choice" },
    { tag:"COMPLETE", tagIcon:"✏️", instruction:"QUAL LETRA FALTA?", spoken:"Qual letra falta em MA...O?", word:"MA _ O", image:"🌴", options:[{label:"T",value:"T",correct:true},{label:"S",value:"S",correct:false},{label:"L",value:"L",correct:false}], type:"choice" },
    { tag:"RIMA",     tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com SOL?", word:"SOL?", options:[{label:"FAROL",value:"FAROL",correct:true},{label:"GATO",value:"GATO",correct:false},{label:"MESA",value:"MESA",correct:false}], type:"choice" },
    { tag:"RIMA",     tagIcon:"🎵", instruction:"QUAL PALAVRA RIMA COM", spoken:"Qual palavra rima com PÃO?", word:"PÃO?", options:[{label:"MÃO",value:"MÃO",correct:true},{label:"BOLO",value:"BOLO",correct:false},{label:"CASA",value:"CASA",correct:false}], type:"choice" },
  ],
  6: [
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO ANIMAL", spoken:"", image:"🐶", answers:["CACHORRO","CACHORO"], type:"write" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DA FRUTA", spoken:"", image:"🍎", answers:["MAÇÃ","MACA","MAÇA"], spellingRule:"accent_tilde", type:"write" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO OBJETO", spoken:"", image:"⚽", answers:["BOLA"], type:"write" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"IRMÃO OU IRMAO?", options:[{label:"IRMÃO",value:"IRMÃO",correct:true},{label:"IRMAO",value:"IRMAO",correct:false}], spellingRule:"accent_tilde", type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO OBJETO", spoken:"", image:"📚", answers:["LIVRO"], type:"write" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"AÇÚCAR OU ACUCAR?", options:[{label:"AÇÚCAR",value:"AÇÚCAR",correct:true},{label:"ACUCAR",value:"ACUCAR",correct:false}], spellingRule:"accent_acute", type:"choice" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"PASSO OU PASO?", options:[{label:"PASSO",value:"PASSO",correct:true},{label:"PASO",value:"PASO",correct:false}], spellingRule:"ss_rule", type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO ANIMAL", spoken:"", image:"🐱", answers:["GATO"], type:"write" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO LUGAR", spoken:"", image:"🏠", answers:["CASA"], type:"write" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"CAIXA OU CHAIXA?", options:[{label:"CAIXA",value:"CAIXA",correct:true},{label:"CHAIXA",value:"CHAIXA",correct:false}], spellingRule:"x_ch_rule", type:"choice" },
  ],
  7: [
    { tag:"FRASE",      tagIcon:"📝", instruction:"QUAL PALAVRA COMPLETA A FRASE?", spoken:"", word:"O GATO FOI PARA A ___", options:[{label:"CASA",value:"CASA",correct:true},{label:"AZUL",value:"AZUL",correct:false},{label:"CORRER",value:"CORRER",correct:false}], type:"choice" },
    { tag:"FRASE",      tagIcon:"📝", instruction:"QUAL PALAVRA COMPLETA A FRASE?", spoken:"", word:"ELA ___ UMA BORBOLETA", options:[{label:"VIU",value:"VIU",correct:true},{label:"MESA",value:"MESA",correct:false},{label:"BONITO",value:"BONITO",correct:false}], type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DA FRUTA", spoken:"", image:"🍌", answers:["BANANA"], type:"write" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"PASSARO OU PÁSSARO?", options:[{label:"PÁSSARO",value:"PÁSSARO",correct:true},{label:"PASSARO",value:"PASSARO",correct:false}], spellingRule:"accent_acute", type:"choice" },
    { tag:"LHNH",       tagIcon:"🔡", instruction:"QUAL PALAVRA TEM O SOM LH?", spoken:"", options:[{label:"FILHO",value:"FILHO",correct:true},{label:"BOLA",value:"BOLA",correct:false},{label:"PATO",value:"PATO",correct:false}], spellingRule:"lh_nh_rule", type:"choice" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"FAZENDA OU FASENDA?", options:[{label:"FAZENDA",value:"FAZENDA",correct:true},{label:"FASENDA",value:"FASENDA",correct:false}], spellingRule:"z_rule", type:"choice" },
    { tag:"FRASE",      tagIcon:"📝", instruction:"QUAL PALAVRA COMPLETA A FRASE?", spoken:"", word:"O CACHORRO ___ MUITO FELIZ", options:[{label:"ESTAVA",value:"ESTAVA",correct:true},{label:"AZUL",value:"AZUL",correct:false},{label:"CORREU",value:"CORREU",correct:false}], type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO ANIMAL", spoken:"", image:"🐸", answers:["SAPO"], type:"write" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"CHAVE OU XAVE?", options:[{label:"CHAVE",value:"CHAVE",correct:true},{label:"XAVE",value:"XAVE",correct:false}], spellingRule:"x_ch_rule", type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO ANIMAL", spoken:"", image:"🐦", answers:["PATO","PASSARO","PÁSSARO"], type:"write" },
  ],
  8: [
    { tag:"LEITURA",  tagIcon:"📖", instruction:"LEIA E RESPONDA: O GATO ESTÁ EM CIMA DA CAIXA. ONDE ESTÁ O GATO?", spoken:"", options:[{label:"DENTRO",value:"dentro",correct:false},{label:"EM CIMA",value:"cima",correct:true},{label:"ATRÁS",value:"atrás",correct:false}], type:"choice" },
    { tag:"LEITURA",  tagIcon:"📖", instruction:"LEIA E RESPONDA: ANA COMEU UMA MAÇÃ VERMELHA. O QUE ANA COMEU?", spoken:"", options:[{label:"UMA PERA",value:"pera",correct:false},{label:"UMA MAÇÃ",value:"maçã",correct:true},{label:"UMA BANANA",value:"banana",correct:false}], type:"choice" },
    { tag:"ESCRITA",  tagIcon:"✍️", instruction:"ESCREVA O NOME DO INSETO", spoken:"", image:"🦋", answers:["BORBOLETA","BORBOLÉTA"], type:"write" },
    { tag:"PLURAL",   tagIcon:"📝", instruction:"QUAL É O PLURAL DE GATO?", spoken:"", options:[{label:"GATOS",value:"GATOS",correct:true},{label:"GATO",value:"GATO",correct:false},{label:"GATÃO",value:"GATÃO",correct:false}], type:"choice" },
    { tag:"SINÔNIMO", tagIcon:"📖", instruction:"QUAL PALAVRA TEM SIGNIFICADO PARECIDO COM FELIZ?", spoken:"", options:[{label:"ALEGRE",value:"ALEGRE",correct:true},{label:"TRISTE",value:"TRISTE",correct:false},{label:"BRAVO",value:"BRAVO",correct:false}], type:"choice" },
    { tag:"LEITURA",  tagIcon:"📖", instruction:"PEDRO CORREU RÁPIDO E GANHOU A CORRIDA. O QUE PEDRO FEZ?", spoken:"", options:[{label:"PERDEU",value:"perdeu",correct:false},{label:"GANHOU",value:"ganhou",correct:true},{label:"CAIU",value:"caiu",correct:false}], type:"choice" },
    { tag:"PLURAL",   tagIcon:"📝", instruction:"QUAL É O PLURAL DE FLOR?", spoken:"", options:[{label:"FLORS",value:"FLORS",correct:false},{label:"FLORES",value:"FLORES",correct:true},{label:"FLORZINHAS",value:"FLORZINHAS",correct:false}], type:"choice" },
    { tag:"ESCRITA",  tagIcon:"✍️", instruction:"ESCREVA O NOME DO LUGAR", spoken:"", image:"🏫", answers:["ESCOLA"], type:"write" },
    { tag:"SINÔNIMO", tagIcon:"📖", instruction:"QUAL PALAVRA TEM SIGNIFICADO PARECIDO COM BONITO?", spoken:"", options:[{label:"FEIO",value:"FEIO",correct:false},{label:"LINDO",value:"LINDO",correct:true},{label:"VELHO",value:"VELHO",correct:false}], type:"choice" },
    { tag:"ORDEM",    tagIcon:"🔢", instruction:"QUAL PALAVRA VEM PRIMEIRO NO DICIONÁRIO?", spoken:"", options:[{label:"ABACAXI",value:"ABACAXI",correct:true},{label:"MANGA",value:"MANGA",correct:false},{label:"LARANJA",value:"LARANJA",correct:false}], type:"choice" },
  ],
  9: [
    { tag:"GRAMÁTICA",  tagIcon:"📝", instruction:"QUAL É O FEMININO DE CACHORRO?", spoken:"", options:[{label:"CACHORRA",value:"CACHORRA",correct:true},{label:"CACHORRINHA",value:"CACHORRINHA",correct:false},{label:"CACHORROS",value:"CACHORROS",correct:false}], type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO ANIMAL", spoken:"", image:"🦁", answers:["LEÃO","LEAO"], spellingRule:"accent_tilde", type:"write" },
    { tag:"ANTÔNIMO",   tagIcon:"📖", instruction:"QUAL É O CONTRÁRIO DE QUENTE?", spoken:"", options:[{label:"FRIO",value:"FRIO",correct:true},{label:"MORNO",value:"MORNO",correct:false},{label:"GELADO",value:"GELADO",correct:false}], type:"choice" },
    { tag:"LEITURA",    tagIcon:"📖", instruction:"ELA GOSTAVA MUITO DE FLORES. O QUE ELA GOSTAVA?", spoken:"", options:[{label:"DE FLORES",value:"flores",correct:true},{label:"DE FRUTAS",value:"frutas",correct:false},{label:"DE LIVROS",value:"livros",correct:false}], type:"choice" },
    { tag:"ORTOGRAFIA", tagIcon:"📝", instruction:"QUAL A ESCRITA CORRETA?", spoken:"", word:"CORAÇÃO OU CORACAO?", options:[{label:"CORAÇÃO",value:"CORAÇÃO",correct:true},{label:"CORACAO",value:"CORACAO",correct:false}], spellingRule:"accent_tilde", type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA O NOME DO LUGAR", spoken:"", image:"🏫", answers:["ESCOLA"], type:"write" },
    { tag:"GRAMÁTICA",  tagIcon:"📝", instruction:"QUAL É O PLURAL DE FLOR?", spoken:"", options:[{label:"FLORS",value:"FLORS",correct:false},{label:"FLORES",value:"FLORES",correct:true},{label:"FLORZINHAS",value:"FLORZINHAS",correct:false}], type:"choice" },
    { tag:"ANTÔNIMO",   tagIcon:"📖", instruction:"QUAL É O CONTRÁRIO DE BONITO?", spoken:"", options:[{label:"FEIO",value:"FEIO",correct:true},{label:"LINDO",value:"LINDO",correct:false},{label:"NOVO",value:"NOVO",correct:false}], type:"choice" },
    { tag:"GRAMÁTICA",  tagIcon:"📝", instruction:"QUAL É O FEMININO DE LEÃO?", spoken:"", options:[{label:"LEOA",value:"LEOA",correct:true},{label:"LEÕES",value:"LEÕES",correct:false},{label:"LEÃOZINHO",value:"LEÃOZINHO",correct:false}], type:"choice" },
    { tag:"ESCRITA",    tagIcon:"✍️", instruction:"ESCREVA UMA PALAVRA QUE RIME COM FELIZ", spoken:"", answers:["NARIZ","RAIZ","INFELIZ","DESLIZ"], type:"write" },
  ],
};

// ════════════════════════════════════════════════════════════════
// MATH ACTIVITIES — 8 levels
// ════════════════════════════════════════════════════════════════

const MATH_ACTIVITIES: Record<number, Activity[]> = {
  1: [
    { tag:"CONTAGEM", tagIcon:"🔢", instruction:"QUANTOS ⭐ VOCÊ VÊ?", spoken:"Quantas estrelas você vê?", mathDisplay:"⭐ ⭐ ⭐", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
    { tag:"CONTAGEM", tagIcon:"🔢", instruction:"QUANTAS 🍎 TEM AQUI?", spoken:"Quantas maçãs tem aqui?", mathDisplay:"🍎 🍎 🍎 🍎 🍎", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true}], type:"choice" },
    { tag:"CONTAGEM", tagIcon:"🔢", instruction:"QUANTOS 🐥 HÁ AQUI?", spoken:"Quantos pintinhos há aqui?", mathDisplay:"🐥 🐥", options:[{label:"1",value:"1",correct:false},{label:"2",value:"2",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
    { tag:"COMPARAR", tagIcon:"⚖️", instruction:"QUAL GRUPO TEM MAIS?", spoken:"Qual grupo tem mais objetos?", options:[{label:"🍎🍎🍎",value:"3",correct:true},{label:"🍎🍎",value:"2",correct:false},{label:"🍎",value:"1",correct:false}], type:"choice" },
    { tag:"CONTAGEM", tagIcon:"🔢", instruction:"QUANTAS 🌟 VOCÊ VÊ?", spoken:"Quantas estrelas douradas você vê?", mathDisplay:"🌟 🌟 🌟 🌟", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true},{label:"5",value:"5",correct:false}], type:"choice" },
    { tag:"COMPARAR", tagIcon:"⚖️", instruction:"QUAL NÚMERO É MAIOR?", spoken:"Qual dos números é maior?", options:[{label:"2",value:"2",correct:false},{label:"5",value:"5",correct:true},{label:"1",value:"1",correct:false}], type:"choice" },
    { tag:"CONTAGEM", tagIcon:"🔢", instruction:"QUANTOS 🐟 VOCÊ VÊ?", spoken:"Quantos peixinhos você vê?", mathDisplay:"🐟", options:[{label:"1",value:"1",correct:true},{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:false}], type:"choice" },
    { tag:"COMPARAR", tagIcon:"⚖️", instruction:"QUAL GRUPO TEM MENOS?", spoken:"Qual grupo tem menos?", options:[{label:"🌸🌸🌸🌸",value:"4",correct:false},{label:"🌸",value:"1",correct:true},{label:"🌸🌸",value:"2",correct:false}], type:"choice" },
    { tag:"CONTAGEM", tagIcon:"🔢", instruction:"QUANTAS 🍪 TEM?", spoken:"Quantas bolachas tem?", mathDisplay:"🍪 🍪 🍪", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
    { tag:"COMPARAR", tagIcon:"⚖️", instruction:"QUAL NÚMERO É MENOR?", spoken:"Qual número é menor?", options:[{label:"4",value:"4",correct:false},{label:"1",value:"1",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
  ],
  2: [
    { tag:"CONTAGEM",  tagIcon:"🔢", instruction:"QUANTOS 🐥 HÁ AQUI?", spoken:"Quantos pintinhos há aqui?", mathDisplay:"🐥🐥🐥🐥🐥🐥🐥", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"SEQUÊNCIA", tagIcon:"🔢", instruction:"QUAL NÚMERO VEM DEPOIS DO 5?", spoken:"Qual número vem depois do 5?", options:[{label:"4",value:"4",correct:false},{label:"6",value:"6",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
    { tag:"CONTAGEM",  tagIcon:"🔢", instruction:"QUANTAS 🍎 EXISTEM?", spoken:"Quantas maçãs existem?", mathDisplay:"🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:false},{label:"10",value:"10",correct:true}], type:"choice" },
    { tag:"COMPARAR",  tagIcon:"⚖️", instruction:"QUAL NÚMERO É MENOR?", spoken:"Qual número é menor?", options:[{label:"9",value:"9",correct:false},{label:"3",value:"3",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
    { tag:"SEQUÊNCIA", tagIcon:"🔢", instruction:"QUAL NÚMERO VEM ANTES DO 9?", spoken:"Qual número vem antes do 9?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"SEQUÊNCIA", tagIcon:"🔢", instruction:"QUAL VEM DEPOIS DO 12?", spoken:"Qual número vem depois do 12?", options:[{label:"11",value:"11",correct:false},{label:"13",value:"13",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"SEQUÊNCIA", tagIcon:"🔢", instruction:"QUAL NÚMERO FALTA?", spoken:"Qual número falta entre 5 e 7?", word:"5, __, 7", options:[{label:"6",value:"6",correct:true},{label:"4",value:"4",correct:false},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"SEQUÊNCIA", tagIcon:"🔢", instruction:"QUAL NÚMERO FALTA?", spoken:"Qual número falta?", word:"14, __, 16", options:[{label:"13",value:"13",correct:false},{label:"15",value:"15",correct:true},{label:"17",value:"17",correct:false}], type:"choice" },
    { tag:"COMPARAR",  tagIcon:"⚖️", instruction:"QUAL NÚMERO É MAIOR?", spoken:"Qual número é maior?", options:[{label:"15",value:"15",correct:true},{label:"8",value:"8",correct:false},{label:"12",value:"12",correct:false}], type:"choice" },
    { tag:"SEQUÊNCIA", tagIcon:"🔢", instruction:"QUAL VEM ANTES DO 20?", spoken:"Qual número vem antes do 20?", options:[{label:"18",value:"18",correct:false},{label:"19",value:"19",correct:true},{label:"21",value:"21",correct:false}], type:"choice" },
  ],
  3: [
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 1 + 1?", spoken:"Quanto é um mais um?", mathDisplay:"⭐ + ⭐", options:[{label:"1",value:"1",correct:false},{label:"2",value:"2",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 2 + 3?", spoken:"Quanto é dois mais três?", mathDisplay:"🍎🍎 + 🍎🍎🍎", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 4 + 4?", spoken:"Quanto é quatro mais quatro?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 3 + 5?", spoken:"Quanto é três mais cinco?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 6 + 2?", spoken:"Quanto é seis mais dois?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 5 + 4?", spoken:"Quanto é cinco mais quatro?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 7 + 3?", spoken:"Quanto é sete mais três?", options:[{label:"9",value:"9",correct:false},{label:"10",value:"10",correct:true},{label:"11",value:"11",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"TENHO 3 🍎 E GANHO MAIS 4. QUANTAS TENHO?", spoken:"Tenho três maçãs e ganho mais quatro. Quantas tenho?", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 2 + 6?", spoken:"Quanto é dois mais seis?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 1 + 9?", spoken:"Quanto é um mais nove?", options:[{label:"9",value:"9",correct:false},{label:"10",value:"10",correct:true},{label:"11",value:"11",correct:false}], type:"choice" },
  ],
  4: [
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 5 − 2?", spoken:"Quanto é cinco menos dois?", mathDisplay:"⭐⭐⭐⭐⭐ − ⭐⭐", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 8 − 3?", spoken:"Quanto é oito menos três?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 7 − 4?", spoken:"Quanto é sete menos quatro?", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 9 − 5?", spoken:"Quanto é nove menos cinco?", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true},{label:"5",value:"5",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 10 − 6?", spoken:"Quanto é dez menos seis?", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true},{label:"5",value:"5",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"TENHO 8 🍎 E COMO 3. QUANTAS FICAM?", spoken:"Tenho oito maçãs e como três. Quantas ficam?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 6 − 1?", spoken:"Quanto é seis menos um?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 10 − 3?", spoken:"Quanto é dez menos três?", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 9 − 2?", spoken:"Quanto é nove menos dois?", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"TENHO 10 🌟 E DOU 4. QUANTAS FICAM?", spoken:"Tenho dez estrelas e dou quatro. Quantas ficam?", options:[{label:"5",value:"5",correct:false},{label:"6",value:"6",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
  ],
  5: [
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 7 + 6?", spoken:"Quanto é sete mais seis?", options:[{label:"12",value:"12",correct:false},{label:"13",value:"13",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 8 + 9?", spoken:"Quanto é oito mais nove?", options:[{label:"16",value:"16",correct:false},{label:"17",value:"17",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 9 + 9?", spoken:"Quanto é nove mais nove?", options:[{label:"17",value:"17",correct:false},{label:"18",value:"18",correct:true},{label:"19",value:"19",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 6 + 7?", spoken:"Quanto é seis mais sete?", options:[{label:"12",value:"12",correct:false},{label:"13",value:"13",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"TENHO 12 FIGURINHAS E GANHO MAIS 5. QUANTAS TENHO?", spoken:"Tenho doze figurinhas e ganho mais cinco. Quantas tenho?", options:[{label:"16",value:"16",correct:false},{label:"17",value:"17",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 11 + 8?", spoken:"Quanto é onze mais oito?", options:[{label:"18",value:"18",correct:false},{label:"19",value:"19",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 14 + 5?", spoken:"Quanto é quatorze mais cinco?", options:[{label:"18",value:"18",correct:false},{label:"19",value:"19",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 15 + 4?", spoken:"Quanto é quinze mais quatro?", options:[{label:"18",value:"18",correct:false},{label:"19",value:"19",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"QUANTO É 12 + 8?", spoken:"Quanto é doze mais oito?", options:[{label:"19",value:"19",correct:false},{label:"20",value:"20",correct:true},{label:"21",value:"21",correct:false}], type:"choice" },
    { tag:"ADIÇÃO", tagIcon:"➕", instruction:"TENHO 16 BALAS E GANHO 4 MAIS. QUANTAS TENHO?", spoken:"Tenho dezesseis balas e ganho mais quatro. Quantas tenho?", options:[{label:"19",value:"19",correct:false},{label:"20",value:"20",correct:true},{label:"21",value:"21",correct:false}], type:"choice" },
  ],
  6: [
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 15 − 6?", spoken:"Quanto é quinze menos seis?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 18 − 9?", spoken:"Quanto é dezoito menos nove?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 20 − 8?", spoken:"Quanto é vinte menos oito?", options:[{label:"11",value:"11",correct:false},{label:"12",value:"12",correct:true},{label:"13",value:"13",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 17 − 5?", spoken:"Quanto é dezessete menos cinco?", options:[{label:"11",value:"11",correct:false},{label:"12",value:"12",correct:true},{label:"13",value:"13",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"TENHO 20 FIGURINHAS E DOU 7. QUANTAS FICAM?", spoken:"Tenho vinte figurinhas e dou sete. Quantas ficam?", options:[{label:"12",value:"12",correct:false},{label:"13",value:"13",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 16 − 7?", spoken:"Quanto é dezesseis menos sete?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 20 − 13?", spoken:"Quanto é vinte menos treze?", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 19 − 4?", spoken:"Quanto é dezenove menos quatro?", options:[{label:"14",value:"14",correct:false},{label:"15",value:"15",correct:true},{label:"16",value:"16",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"QUANTO É 20 − 6?", spoken:"Quanto é vinte menos seis?", options:[{label:"13",value:"13",correct:false},{label:"14",value:"14",correct:true},{label:"15",value:"15",correct:false}], type:"choice" },
    { tag:"SUBTRAÇÃO", tagIcon:"➖", instruction:"TENHO 18 REAIS E GASTO 9. QUANTO SOBRA?", spoken:"Tenho dezoito reais e gasto nove. Quanto sobra?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
  ],
  7: [
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 2 × 3?", spoken:"Quanto é dois vezes três?", mathDisplay:"🍎🍎 + 🍎🍎 + 🍎🍎", options:[{label:"5",value:"5",correct:false},{label:"6",value:"6",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 5 × 2?", spoken:"Quanto é cinco vezes dois?", options:[{label:"8",value:"8",correct:false},{label:"10",value:"10",correct:true},{label:"12",value:"12",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 10 × 2?", spoken:"Quanto é dez vezes dois?", options:[{label:"15",value:"15",correct:false},{label:"20",value:"20",correct:true},{label:"25",value:"25",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 3 × 3?", spoken:"Quanto é três vezes três?", options:[{label:"6",value:"6",correct:false},{label:"9",value:"9",correct:true},{label:"12",value:"12",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"3 CAIXAS COM 5 BOLAS CADA. QUANTAS BOLAS NO TOTAL?", spoken:"Três caixas com cinco bolas cada. Quantas bolas no total?", options:[{label:"12",value:"12",correct:false},{label:"15",value:"15",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 2 × 8?", spoken:"Quanto é dois vezes oito?", options:[{label:"14",value:"14",correct:false},{label:"16",value:"16",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 5 × 4?", spoken:"Quanto é cinco vezes quatro?", options:[{label:"18",value:"18",correct:false},{label:"20",value:"20",correct:true},{label:"22",value:"22",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 3 × 5?", spoken:"Quanto é três vezes cinco?", options:[{label:"13",value:"13",correct:false},{label:"15",value:"15",correct:true},{label:"17",value:"17",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"QUANTO É 10 × 3?", spoken:"Quanto é dez vezes três?", options:[{label:"20",value:"20",correct:false},{label:"30",value:"30",correct:true},{label:"40",value:"40",correct:false}], type:"choice" },
    { tag:"MULTIPLICAÇÃO", tagIcon:"✖️", instruction:"5 CRIANÇAS TÊM 2 BALAS CADA. QUANTAS BALAS NO TOTAL?", spoken:"Cinco crianças têm duas balas cada. Quantas balas no total?", options:[{label:"8",value:"8",correct:false},{label:"10",value:"10",correct:true},{label:"12",value:"12",correct:false}], type:"choice" },
  ],
  8: [
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"ANA TEM 8 LÁPIS. GANHOU MAIS 4. QUANTOS LÁPIS AGORA?", spoken:"Ana tem oito lápis. Ela ganhou mais quatro. Quantos lápis agora?", options:[{label:"10",value:"10",correct:false},{label:"12",value:"12",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"PEDRO TINHA 15 FIGURINHAS E PERDEU 7. QUANTAS FICARAM?", spoken:"Pedro tinha quinze figurinhas e perdeu sete. Quantas ficaram?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"UMA CAIXA TEM 5 BOLAS. 3 CAIXAS = QUANTAS BOLAS?", spoken:"Uma caixa tem cinco bolas. Três caixas são quantas bolas?", options:[{label:"13",value:"13",correct:false},{label:"15",value:"15",correct:true},{label:"17",value:"17",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"NA TURMA HÁ 12 MENINAS E 9 MENINOS. QUANTAS CRIANÇAS AO TOTAL?", spoken:"Na turma há doze meninas e nove meninos. Quantas crianças ao total?", options:[{label:"20",value:"20",correct:false},{label:"21",value:"21",correct:true},{label:"22",value:"22",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"3 PACOTES COM 6 BALAS CADA = QUANTAS BALAS?", spoken:"Três pacotes com seis balas cada são quantas balas?", options:[{label:"16",value:"16",correct:false},{label:"18",value:"18",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"TENHO 20 REAIS E GASTO 13. QUANTO SOBRA?", spoken:"Tenho vinte reais e gasto treze. Quanto sobra?", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"SE 2 × 7 = 14, QUANTO É 2 × 8?", spoken:"Se dois vezes sete é quatorze, quanto é dois vezes oito?", options:[{label:"15",value:"15",correct:false},{label:"16",value:"16",correct:true},{label:"17",value:"17",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"5 CRIANÇAS TÊM 4 BALAS CADA. QUANTAS BALAS NO TOTAL?", spoken:"Cinco crianças têm quatro balas cada. Quantas balas no total?", options:[{label:"18",value:"18",correct:false},{label:"20",value:"20",correct:true},{label:"22",value:"22",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"TENHO 25 FIGURINHAS E DOU 8 PARA UM AMIGO. QUANTAS FICAM?", spoken:"Tenho vinte e cinco figurinhas e dou oito. Quantas ficam?", options:[{label:"16",value:"16",correct:false},{label:"17",value:"17",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
    { tag:"PROBLEMA", tagIcon:"🧮", instruction:"4 AMIGOS DIVIDEM 20 BALAS IGUALMENTE. QUANTAS BALAS CADA UM GANHA?", spoken:"Quatro amigos dividem vinte balas igualmente. Quantas balas cada um ganha?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
  ],
};

// ════════════════════════════════════════════════════════════════
// SONDAGEM — formato spell para todos os níveis
// A criança apenas ouve a palavra e escreve. Sem feedback de certo/errado.
// Resultados vão silenciosamente para o professor.
// ════════════════════════════════════════════════════════════════

const LITERACY_SONDAGEM: Record<number, Activity[]> = {
  1: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Gato", answers:["GATO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Bola", answers:["BOLA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Pato", answers:["PATO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Casa", answers:["CASA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Sapo", answers:["SAPO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Mala", answers:["MALA"], type:"spell" },
  ],
  2: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Gato", answers:["GATO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Bola", answers:["BOLA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Pato", answers:["PATO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Casa", answers:["CASA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Sapo", answers:["SAPO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Mala", answers:["MALA"], type:"spell" },
  ],
  3: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Cama", answers:["CAMA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Mesa", answers:["MESA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Faca", answers:["FACA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Lobo", answers:["LOBO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Pena", answers:["PENA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Bico", answers:["BICO"], type:"spell" },
  ],
  4: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Pele", answers:["PELE"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Gelo", answers:["GELO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Bolo", answers:["BOLO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Vela", answers:["VELA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Fada", answers:["FADA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Roda", answers:["RODA"], type:"spell" },
  ],
  5: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Escola", answers:["ESCOLA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Livro", answers:["LIVRO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Porta", answers:["PORTA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Cobra", answers:["COBRA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Pedra", answers:["PEDRA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Flor", answers:["FLOR"], type:"spell" },
  ],
  6: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Cachorro", answers:["CACHORRO","CACHORO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Escola", answers:["ESCOLA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Livro", answers:["LIVRO"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Irmão", answers:["IRMÃO","IRMAO"], spellingRule:"accent_tilde", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Caixa", answers:["CAIXA"], spellingRule:"x_ch_rule", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Maçã", answers:["MAÇÃ","MACA","MAÇA"], spellingRule:"accent_tilde", type:"spell" },
  ],
  7: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Borboleta", answers:["BORBOLETA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Pássaro", answers:["PÁSSARO","PASSARO"], spellingRule:"accent_acute", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Fazenda", answers:["FAZENDA"], spellingRule:"z_rule", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Filho", answers:["FILHO"], spellingRule:"lh_nh_rule", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Banana", answers:["BANANA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Janela", answers:["JANELA"], type:"spell" },
  ],
  8: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Coração", answers:["CORAÇÃO","CORACAO"], spellingRule:"accent_tilde", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Borracha", answers:["BORRACHA","BORACHA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Árvore", answers:["ÁRVORE","ARVORE"], spellingRule:"accent_acute", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Formiga", answers:["FORMIGA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Chuveiro", answers:["CHUVEIRO"], spellingRule:"x_ch_rule", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Girafa", answers:["GIRAFA"], type:"spell" },
  ],
  9: [
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Borboleta", answers:["BORBOLETA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Alegria", answers:["ALEGRIA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Coração", answers:["CORAÇÃO","CORACAO"], spellingRule:"accent_tilde", type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Felicidade", answers:["FELICIDADE"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Aventura", answers:["AVENTURA"], type:"spell" },
    { tag:"SONDAGEM", tagIcon:"🎵", instruction:"", spoken:"Descoberta", answers:["DESCOBERTA"], type:"spell" },
  ],
};

const MATH_SONDAGEM: Record<number, Activity[]> = {
  1: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTOS ⭐ VOCÊ VÊ?", spoken:"Quantas estrelas você vê?", mathDisplay:"⭐ ⭐ ⭐", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL NÚMERO É MAIOR?", spoken:"Qual número é maior?", options:[{label:"2",value:"2",correct:false},{label:"5",value:"5",correct:true},{label:"1",value:"1",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTAS 🍎 TEM AQUI?", spoken:"Quantas maçãs tem aqui?", mathDisplay:"🍎 🍎 🍎 🍎", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true},{label:"5",value:"5",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL GRUPO TEM MAIS?", spoken:"Qual grupo tem mais?", options:[{label:"🍎🍎",value:"2",correct:false},{label:"🍎🍎🍎🍎",value:"4",correct:true},{label:"🍎",value:"1",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL NÚMERO É MENOR?", spoken:"Qual número é menor?", options:[{label:"4",value:"4",correct:false},{label:"1",value:"1",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTAS 🌟 TEM?", spoken:"Quantas estrelas douradas tem?", mathDisplay:"🌟 🌟", options:[{label:"1",value:"1",correct:false},{label:"2",value:"2",correct:true},{label:"3",value:"3",correct:false}], type:"choice" },
  ],
  2: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL NÚMERO VEM DEPOIS DO 7?", spoken:"Qual número vem depois do 7?", options:[{label:"6",value:"6",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTAS 🐥?", spoken:"Quantos pintinhos?", mathDisplay:"🐥🐥🐥🐥🐥🐥🐥🐥", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL NÚMERO FALTA?", spoken:"Qual número falta?", word:"10, __, 12", options:[{label:"11",value:"11",correct:true},{label:"13",value:"13",correct:false},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL NÚMERO É MENOR?", spoken:"Qual número é menor?", options:[{label:"9",value:"9",correct:false},{label:"3",value:"3",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL VEM ANTES DO 15?", spoken:"Qual número vem antes do 15?", options:[{label:"13",value:"13",correct:false},{label:"14",value:"14",correct:true},{label:"16",value:"16",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUAL NÚMERO FALTA?", spoken:"Qual número falta?", word:"17, __, 19", options:[{label:"16",value:"16",correct:false},{label:"18",value:"18",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
  ],
  3: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 2 + 3?", spoken:"Quanto é dois mais três?", mathDisplay:"🍎🍎 + 🍎🍎🍎", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 4 + 4?", spoken:"Quanto é quatro mais quatro?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"TENHO 5 🍎 E GANHO 3. QUANTAS TENHO?", spoken:"Tenho cinco maçãs e ganho três. Quantas tenho?", options:[{label:"7",value:"7",correct:false},{label:"8",value:"8",correct:true},{label:"9",value:"9",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 7 + 3?", spoken:"Quanto é sete mais três?", options:[{label:"9",value:"9",correct:false},{label:"10",value:"10",correct:true},{label:"11",value:"11",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 1 + 9?", spoken:"Quanto é um mais nove?", options:[{label:"9",value:"9",correct:false},{label:"10",value:"10",correct:true},{label:"11",value:"11",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 6 + 3?", spoken:"Quanto é seis mais três?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
  ],
  4: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 5 − 2?", spoken:"Quanto é cinco menos dois?", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 8 − 3?", spoken:"Quanto é oito menos três?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"TENHO 9 LÁPIS E PERCO 4. QUANTOS FICAM?", spoken:"Tenho nove lápis e perco quatro. Quantos ficam?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 10 − 4?", spoken:"Quanto é dez menos quatro?", options:[{label:"5",value:"5",correct:false},{label:"6",value:"6",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 7 − 3?", spoken:"Quanto é sete menos três?", options:[{label:"3",value:"3",correct:false},{label:"4",value:"4",correct:true},{label:"5",value:"5",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 9 − 6?", spoken:"Quanto é nove menos seis?", options:[{label:"2",value:"2",correct:false},{label:"3",value:"3",correct:true},{label:"4",value:"4",correct:false}], type:"choice" },
  ],
  5: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 7 + 6?", spoken:"Quanto é sete mais seis?", options:[{label:"12",value:"12",correct:false},{label:"13",value:"13",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 9 + 8?", spoken:"Quanto é nove mais oito?", options:[{label:"16",value:"16",correct:false},{label:"17",value:"17",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 14 + 6?", spoken:"Quanto é quatorze mais seis?", options:[{label:"19",value:"19",correct:false},{label:"20",value:"20",correct:true},{label:"21",value:"21",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"TENHO 11 FIGURINHAS E GANHO 7. QUANTAS TENHO?", spoken:"Tenho onze figurinhas e ganho sete. Quantas tenho?", options:[{label:"17",value:"17",correct:false},{label:"18",value:"18",correct:true},{label:"19",value:"19",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 12 + 7?", spoken:"Quanto é doze mais sete?", options:[{label:"18",value:"18",correct:false},{label:"19",value:"19",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 15 + 5?", spoken:"Quanto é quinze mais cinco?", options:[{label:"19",value:"19",correct:false},{label:"20",value:"20",correct:true},{label:"21",value:"21",correct:false}], type:"choice" },
  ],
  6: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 15 − 6?", spoken:"Quanto é quinze menos seis?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 20 − 8?", spoken:"Quanto é vinte menos oito?", options:[{label:"11",value:"11",correct:false},{label:"12",value:"12",correct:true},{label:"13",value:"13",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"TENHO 18 BALAS E DOU 9. QUANTAS FICAM?", spoken:"Tenho dezoito balas e dou nove. Quantas ficam?", options:[{label:"8",value:"8",correct:false},{label:"9",value:"9",correct:true},{label:"10",value:"10",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 17 − 5?", spoken:"Quanto é dezessete menos cinco?", options:[{label:"11",value:"11",correct:false},{label:"12",value:"12",correct:true},{label:"13",value:"13",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 20 − 14?", spoken:"Quanto é vinte menos quatorze?", options:[{label:"5",value:"5",correct:false},{label:"6",value:"6",correct:true},{label:"7",value:"7",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 19 − 7?", spoken:"Quanto é dezenove menos sete?", options:[{label:"11",value:"11",correct:false},{label:"12",value:"12",correct:true},{label:"13",value:"13",correct:false}], type:"choice" },
  ],
  7: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 2 × 5?", spoken:"Quanto é dois vezes cinco?", options:[{label:"8",value:"8",correct:false},{label:"10",value:"10",correct:true},{label:"12",value:"12",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 3 × 4?", spoken:"Quanto é três vezes quatro?", options:[{label:"10",value:"10",correct:false},{label:"12",value:"12",correct:true},{label:"14",value:"14",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"4 CAIXAS COM 5 BOLAS = QUANTAS BOLAS?", spoken:"Quatro caixas com cinco bolas. Quantas bolas no total?", options:[{label:"18",value:"18",correct:false},{label:"20",value:"20",correct:true},{label:"22",value:"22",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 5 × 5?", spoken:"Quanto é cinco vezes cinco?", options:[{label:"20",value:"20",correct:false},{label:"25",value:"25",correct:true},{label:"30",value:"30",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 10 × 3?", spoken:"Quanto é dez vezes três?", options:[{label:"20",value:"20",correct:false},{label:"30",value:"30",correct:true},{label:"40",value:"40",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 2 × 9?", spoken:"Quanto é dois vezes nove?", options:[{label:"16",value:"16",correct:false},{label:"18",value:"18",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
  ],
  8: [
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"ANA TEM 12 LÁPIS E GANHOU MAIS 8. QUANTOS ELA TEM?", spoken:"Ana tem doze lápis e ganhou mais oito. Quantos ela tem?", options:[{label:"19",value:"19",correct:false},{label:"20",value:"20",correct:true},{label:"21",value:"21",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"PEDRO TINHA 20 REAIS E GASTOU 13. QUANTO SOBROU?", spoken:"Pedro tinha vinte reais e gastou treze. Quanto sobrou?", options:[{label:"6",value:"6",correct:false},{label:"7",value:"7",correct:true},{label:"8",value:"8",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"3 PACOTES COM 6 BALAS CADA = QUANTAS BALAS?", spoken:"Três pacotes com seis balas cada. Quantas balas no total?", options:[{label:"16",value:"16",correct:false},{label:"18",value:"18",correct:true},{label:"20",value:"20",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 9 + 13?", spoken:"Quanto é nove mais treze?", options:[{label:"21",value:"21",correct:false},{label:"22",value:"22",correct:true},{label:"23",value:"23",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"4 AMIGOS DIVIDEM 20 BALAS. CADA UM GANHA QUANTAS?", spoken:"Quatro amigos dividem vinte balas igualmente. Cada um ganha quantas?", options:[{label:"4",value:"4",correct:false},{label:"5",value:"5",correct:true},{label:"6",value:"6",correct:false}], type:"choice" },
    { tag:"SONDAGEM", tagIcon:"🔍", instruction:"QUANTO É 25 − 8?", spoken:"Quanto é vinte e cinco menos oito?", options:[{label:"16",value:"16",correct:false},{label:"17",value:"17",correct:true},{label:"18",value:"18",correct:false}], type:"choice" },
  ],
};

// ════════════════════════════════════════════════════════════════
// INITIAL STUDENTS
// ════════════════════════════════════════════════════════════════

const initialStudents: Student[] = [
  { id:1, name:"ANA",   emoji:"🦋", literacyLevel:1, literacyStars:0, literacyMissionsDone:0, lastLiteracySondagem:null, mathLevel:1, mathStars:0, mathMissionsDone:0, lastMathSondagem:null, sondagemHistory:[], skills:{letras:30,silabas:20,sons:15,palavras:20,escrita:10}, attempts:0, accuracy:0, audioEnabled:true },
  { id:2, name:"JOÃO",  emoji:"🐯", literacyLevel:1, literacyStars:0, literacyMissionsDone:0, lastLiteracySondagem:null, mathLevel:1, mathStars:0, mathMissionsDone:0, lastMathSondagem:null, sondagemHistory:[], skills:{letras:25,silabas:15,sons:20,palavras:15,escrita:10}, attempts:0, accuracy:0, audioEnabled:true },
  { id:3, name:"MARIA", emoji:"🐸", literacyLevel:1, literacyStars:0, literacyMissionsDone:0, lastLiteracySondagem:null, mathLevel:1, mathStars:0, mathMissionsDone:0, lastMathSondagem:null, sondagemHistory:[], skills:{letras:20,silabas:15,sons:10,palavras:15,escrita:5},  attempts:0, accuracy:0, audioEnabled:true },
  { id:4, name:"PEDRO", emoji:"🦁", literacyLevel:1, literacyStars:0, literacyMissionsDone:0, lastLiteracySondagem:null, mathLevel:1, mathStars:0, mathMissionsDone:0, lastMathSondagem:null, sondagemHistory:[], skills:{letras:35,silabas:25,sons:20,palavras:25,escrita:15}, attempts:0, accuracy:0, audioEnabled:true },
  { id:5, name:"SOFIA", emoji:"🦄", literacyLevel:1, literacyStars:0, literacyMissionsDone:0, lastLiteracySondagem:null, mathLevel:1, mathStars:0, mathMissionsDone:0, lastMathSondagem:null, sondagemHistory:[], skills:{letras:20,silabas:10,sons:10,palavras:10,escrita:5},  attempts:0, accuracy:0, audioEnabled:true },
  { id:6, name:"LUCAS", emoji:"🚀", literacyLevel:1, literacyStars:0, literacyMissionsDone:0, lastLiteracySondagem:null, mathLevel:1, mathStars:0, mathMissionsDone:0, lastMathSondagem:null, sondagemHistory:[], skills:{letras:30,silabas:20,sons:15,palavras:20,escrita:10}, attempts:0, accuracy:0, audioEnabled:true },
];

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function getLevelForArea(s: Student, area: Area) { return area === "literacy" ? s.literacyLevel : s.mathLevel; }
function getActivities(area: Area, level: number): Activity[] {
  return area === "literacy" ? (LITERACY_ACTIVITIES[level] ?? LITERACY_ACTIVITIES[6]) : (MATH_ACTIVITIES[level] ?? MATH_ACTIVITIES[5]);
}
function getSondagem(area: Area, level: number): Activity[] {
  return area === "literacy" ? (LITERACY_SONDAGEM[level] ?? LITERACY_SONDAGEM[1]) : (MATH_SONDAGEM[level] ?? MATH_SONDAGEM[1]);
}
function getMeta(area: Area, level: number) { return area === "literacy" ? LIT_META[level] : MATH_META[level]; }
function getLevelName(area: Area, level: number) { return area === "literacy" ? (LIT_META[level]?.name ?? "") : (MATH_META[level]?.name ?? ""); }
function needsSondagem(s: Student, area: Area) {
  return area === "literacy" ? s.lastLiteracySondagem !== today() : s.lastMathSondagem !== today();
}

const WRONG_MSGS = [
  "QUASE LÁ! TENTE DE NOVO! 💪",
  "NÃO DESISTA! VOCÊ CONSEGUE! 🌟",
  "ATENÇÃO! OBSERVE BEM! 👀",
  "RESPIRA FUNDO E TENTA DE NOVO! 🌈",
  "VOCÊ ESTÁ APRENDENDO! CONTINUE! 🚀",
];
const HINT_MSGS = [
  ["💡 PRESTA BEM ATENÇÃO NA PERGUNTA!","💡 ELIMINE AS OPÇÕES QUE VOCÊ TEM CERTEZA QUE NÃO SÃO!","💡 OLHA COM CUIDADO — A RESPOSTA ESTÁ AQUI!"],
  ["💡 LEIA A PERGUNTA DEVAGAR!","💡 TENTA PENSAR EM VOZ ALTA!","💡 VOCÊ ESTÁ QUASE LÁ!"],
  ["💡 PENSA EM O QUE VOCÊ JÁ APRENDEU!","💡 OLHA AS OPÇÕES QUE RESTARAM!","💡 CONFIE EM VOCÊ!"],
];

// ════════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ════════════════════════════════════════════════════════════════

function Stars({ count, max = 5, size = "text-lg" }: { count: number; max?: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => <span key={i} className={`${size} ${i < count ? "text-amber-400" : "text-gray-200"}`}>★</span>)}
    </div>
  );
}

function AudioBtn({ text, size = "sm", autoPlay, audioEnabled = true }: { text: string; size?: "sm" | "lg"; autoPlay?: boolean; audioEnabled?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const handle = useCallback(() => {
    if (!audioEnabled) return;
    setPlaying(true);
    speak(text, () => setPlaying(false));
    setTimeout(() => setPlaying(false), 8000);
  }, [text, audioEnabled]);
  useEffect(() => {
    if (autoPlay && text && audioEnabled) { const t = setTimeout(handle, 300); return () => clearTimeout(t); }
  }, [autoPlay, handle, audioEnabled]);
  if (!audioEnabled) return null;
  if (size === "lg") return (
    <button onClick={handle}
      className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 shadow-lg border-2 ${playing ? "bg-amber-400 border-amber-500 text-white scale-105 shadow-amber-200" : "bg-white border-violet-200 text-violet-700 hover:border-violet-400 hover:shadow-md"}`}
      style={{ fontFamily:"Fredoka,sans-serif" }}>
      <span className="text-2xl">{playing ? "🔊" : "🔉"}</span>
      <span className="text-lg">{playing ? "OUVINDO..." : "TOQUE PARA OUVIR"}</span>
    </button>
  );
  return (
    <button onClick={handle}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 flex-shrink-0 border-2 ${playing ? "bg-amber-400 border-amber-500 text-white" : "bg-white border-violet-200 text-violet-600 hover:border-violet-400"}`}
      style={{ fontFamily:"Fredoka,sans-serif" }}>
      <span>{playing ? "🔊" : "🔉"}</span><span>OUVIR</span>
    </button>
  );
}

function Confetti() {
  const pieces = useRef(Array.from({ length: 40 }, (_, i) => ({
    id: i, x: Math.random() * 100,
    color: ["#fbbf24","#8b5cf6","#10b981","#ef4444","#3b82f6","#ec4899","#f97316"][i % 7],
    delay: Math.random() * 1.5, dur: 2.5 + Math.random() * 2, size: 7 + Math.random() * 10,
  }))).current;
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <div key={p.id} className="absolute rounded-sm"
          style={{ left:`${p.x}%`, top:"-20px", width:p.size, height:p.size * 0.55, background:p.color,
            animationName:"confetti-fall", animationDuration:`${p.dur}s`, animationDelay:`${p.delay}s`, animationFillMode:"forwards" }} />
      ))}
    </div>
  );
}

function SpellingRuleCard({ rk }: { rk: SpellingRuleKey }) {
  const r = SPELLING_RULES[rk];
  return (
    <div className={`rounded-2xl border-2 p-3 mt-3 animate-slide-up ${r.color}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{r.icon}</span>
        <p className={`font-bold text-sm ${r.tc}`}>{r.title}</p>
      </div>
      <p className="text-sm text-gray-700 mb-2 font-bold leading-relaxed">{r.rule}</p>
      <div className="flex flex-wrap gap-1.5">
        {r.examples.split(" · ").map((ex) => <span key={ex} className="bg-white px-2 py-0.5 rounded-lg text-xs font-bold text-gray-700 border border-gray-200">{ex}</span>)}
      </div>
    </div>
  );
}

function RevealCard({ activity, onNext }: { activity: Activity; onNext: () => void }) {
  const correct = activity.options?.find((o) => o.correct);
  const ans = activity.answers?.[0];
  return (
    <div className="animate-slide-up">
      <div className="flex justify-center mb-2"><span className="text-5xl animate-wiggle">🤔</span></div>
      <p className="text-center font-bold text-gray-500 text-base mb-3" style={{ fontFamily:"Fredoka,sans-serif" }}>A RESPOSTA CERTA ERA:</p>
      <div className="flex justify-center mb-3">
        <div className="animate-reveal-glow bg-emerald-50 border-4 border-emerald-400 rounded-2xl px-8 py-4 text-3xl font-bold text-emerald-700" style={{ fontFamily:"Fredoka,sans-serif" }}>
          {correct?.label ?? ans}
        </div>
      </div>
      {activity.spellingRule && <SpellingRuleCard rk={activity.spellingRule} />}
      <button onClick={onNext}
        className="w-full mt-4 py-3 rounded-2xl font-bold text-white text-base bg-violet-500 hover:bg-violet-600 active:scale-95 transition-all shadow-md"
        style={{ fontFamily:"Fredoka,sans-serif" }}>
        ENTENDI! PRÓXIMA MISSÃO →
      </button>
    </div>
  );
}

// ─── Virtual Keyboard ─────────────────────────────────────────

const KB_ROWS = [
  ["A","B","C","D","E","F","G","H","I"],
  ["J","K","L","M","N","O","P","Q","R"],
  ["S","T","U","V","W","X","Y","Z","Ç"],
  ["Ã","Ê","Â","Ô","É","Í","Ó","Ú","Õ"],
];

function VirtualKeyboard({ value, onChange, onConfirm, accentColor = "#7c3aed" }: {
  value: string; onChange: (v: string) => void; onConfirm: () => void; accentColor?: string;
}) {
  return (
    <div className="space-y-1.5">
      {KB_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {row.map((k) => (
            <button key={k} onClick={() => onChange(value + k)}
              className="w-8 h-9 rounded-xl bg-white border-2 border-gray-200 text-gray-800 font-bold text-sm hover:bg-violet-50 hover:border-violet-300 active:scale-90 transition-all shadow-sm"
              style={{ fontFamily:"Fredoka,sans-serif" }}>{k}</button>
          ))}
        </div>
      ))}
      <div className="flex gap-2 justify-center mt-2">
        <button onClick={() => onChange("")}
          className="px-3 py-2 rounded-xl bg-gray-100 border-2 border-gray-200 text-gray-500 font-bold text-xs hover:bg-gray-200 active:scale-90 transition-all"
          style={{ fontFamily:"Fredoka,sans-serif" }}>LIMPAR</button>
        <button onClick={() => onChange(value.slice(0, -1))}
          className="px-4 py-2 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-100 active:scale-90 transition-all"
          style={{ fontFamily:"Fredoka,sans-serif" }}>⌫</button>
        <button onClick={onConfirm} disabled={!value.trim()}
          className="px-5 py-2 rounded-xl text-white font-bold text-sm hover:opacity-90 active:scale-90 transition-all disabled:opacity-40 shadow-md"
          style={{ background:accentColor, fontFamily:"Fredoka,sans-serif" }}>✓ OK</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SCREENS
// ════════════════════════════════════════════════════════════════

function AvatarScreen({ students, onSelect, onTeacher }: { students: Student[]; onSelect: (s: Student) => void; onTeacher: () => void }) {
  useEffect(() => { const t = setTimeout(() => speak("Olá! Quem vai jogar hoje?"), 700); return () => clearTimeout(t); }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden"
      style={{ background:"linear-gradient(145deg,#fdf4ff,#ede9fe,#e0e7ff)" }}>
      {[...Array(14)].map((_,i) => (
        <span key={i} className="absolute select-none pointer-events-none text-violet-200"
          style={{ fontSize:`${0.8+i%3*0.5}rem`, left:`${(i*43+9)%97}%`, top:`${(i*67+5)%94}%`,
            animation:`float-slow ${3+i%3}s ease-in-out infinite`, animationDelay:`${i*0.25}s` }}>
          {["✦","✧","⋆","✿","❋"][i%5]}
        </span>
      ))}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-4xl shadow-xl animate-float mb-3 border-4 border-white"
            style={{ background:"linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>🚀</div>
          <p className="text-2xl font-bold text-violet-800 tracking-wide mb-1" style={{ fontFamily:"Fredoka,sans-serif" }}>MISSÃO DAS LETRAS</p>
          <p className="text-3xl font-bold text-violet-600 mb-3" style={{ fontFamily:"Fredoka,sans-serif" }}>QUEM VAI JOGAR? 👆</p>
          <AudioBtn text="Olá! Quem vai jogar hoje?" size="lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {students.map((s) => {
            const litM = LIT_META[s.literacyLevel];
            return (
              <button key={s.id} onClick={() => { speak(`Olá, ${s.name}! Vamos aprender juntos!`); onSelect(s); }}
                className="group bg-white rounded-3xl p-4 flex flex-col items-center gap-1.5 shadow-lg border-4 border-white hover:border-violet-300 hover:shadow-xl active:scale-95 transition-all overflow-hidden relative">
                <div className={`absolute top-0 inset-x-0 h-2 bg-gradient-to-r ${litM.bg}`} />
                <span className="text-4xl mt-1">{s.emoji}</span>
                <span className="text-xl font-bold text-gray-800" style={{ fontFamily:"Fredoka,sans-serif" }}>{s.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${litM.badge}`}>{litM.name}</span>
                <Stars count={s.literacyStars} size="text-sm" />
                {!s.audioEnabled && <span className="text-xs text-gray-400">🔇</span>}
              </button>
            );
          })}
        </div>
        <div className="text-center">
          <button onClick={onTeacher}
            className="px-6 py-2 rounded-full bg-white/80 text-gray-400 text-sm font-bold hover:bg-white hover:text-violet-600 transition-all border-2 border-gray-200 shadow-sm"
            style={{ fontFamily:"Fredoka,sans-serif" }}>
            👩‍🏫 ACESSO DO PROFESSOR
          </button>
        </div>
      </div>
    </div>
  );
}

function AreaSelectScreen({ student, onSelect, onSondagem, onAlphabet, onBack }: {
  student: Student; onSelect: (area: Area) => void; onSondagem: () => void; onAlphabet: () => void; onBack: () => void;
}) {
  useEffect(() => { if (student.audioEnabled) { const t = setTimeout(() => speak(`Olá, ${student.name}! O que vamos fazer hoje?`), 400); return () => clearTimeout(t); } }, []);
  const litM = LIT_META[student.literacyLevel];
  const mathM = MATH_META[student.mathLevel];
  const litPending = needsSondagem(student, "literacy");
  const mathPending = needsSondagem(student, "math");
  const anyPending = litPending || mathPending;
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background:"linear-gradient(145deg,#fdf4ff,#ede9fe,#e0e7ff)" }}>
      <div className="relative z-10 p-5">
        <button onClick={onBack} className="text-violet-400 text-sm font-bold hover:text-violet-600 mb-4 flex items-center gap-1" style={{ fontFamily:"Fredoka,sans-serif" }}>← VOLTAR</button>
      </div>
      <div className="relative z-10 text-center mb-4 px-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-white shadow-lg flex items-center justify-center text-4xl border-4 border-violet-100 mb-2">{student.emoji}</div>
        <p className="text-2xl font-bold text-violet-800" style={{ fontFamily:"Fredoka,sans-serif" }}>OLÁ, {student.name}!</p>
        <p className="text-violet-500 font-bold text-lg" style={{ fontFamily:"Fredoka,sans-serif" }}>O QUE VAMOS FAZER HOJE? 🎯</p>
      </div>
      <div className="relative z-10 flex flex-col gap-3 px-5 pb-8">
        {([["literacy","📚","LEITURA E ESCRITA",litM] as const, ["math","🔢","MATEMÁTICA",mathM] as const]).map(([area, icon, label, m]) => (
          <button key={area} onClick={() => onSelect(area)}
            className="w-full bg-white rounded-3xl p-4 shadow-lg border-4 border-white hover:border-violet-200 active:scale-98 transition-all text-left overflow-hidden relative">
            <div className={`absolute top-0 inset-x-0 h-2 bg-gradient-to-r ${m.bg}`} />
            <div className="flex items-center gap-4 mt-1">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background:m.pastelBg }}>{icon}</div>
              <div className="flex-1">
                <p className="text-xl font-bold text-gray-800" style={{ fontFamily:"Fredoka,sans-serif" }}>{label}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.badge}`}>{m.name}</span>
                <div className="flex gap-0.5 mt-1">{Array.from({length:5}).map((_,i)=><span key={i} className={`text-sm ${i<(area==="literacy"?student.literacyStars:student.mathStars)?"text-amber-400":"text-gray-200"}`}>★</span>)}</div>
              </div>
              <span className="text-2xl text-gray-300">→</span>
            </div>
          </button>
        ))}
        <button onClick={onAlphabet}
          className="w-full bg-white rounded-3xl p-4 shadow-lg border-4 border-white hover:border-amber-200 active:scale-98 transition-all text-left overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="flex items-center gap-4 mt-1">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl flex-shrink-0">🔡</div>
            <div className="flex-1">
              <p className="text-xl font-bold text-gray-800" style={{ fontFamily:"Fredoka,sans-serif" }}>ALFABETO</p>
              <p className="text-xs font-bold text-gray-400">EXPLORE AS LETRAS · A ATÉ Z</p>
            </div>
            <span className="text-2xl text-gray-300">→</span>
          </div>
        </button>
        <button onClick={onSondagem}
          className="w-full rounded-3xl p-4 shadow-lg border-4 transition-all text-left overflow-hidden relative"
          style={{ background:"#f0f9ff", borderColor: anyPending ? "#fbbf24" : "#e0f2fe" }}>
          {anyPending && <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse-glow">📅 HOJE</div>}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">🔍</div>
            <div>
              <p className="text-xl font-bold text-gray-800" style={{ fontFamily:"Fredoka,sans-serif" }}>SONDAGEM</p>
              <div className="flex gap-1.5 mt-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${litPending?"bg-amber-100 text-amber-800":"bg-green-100 text-green-700"}`}>{litPending?"📚 PENDENTE":"📚 FEITA ✓"}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${mathPending?"bg-amber-100 text-amber-800":"bg-green-100 text-green-700"}`}>{mathPending?"🔢 PENDENTE":"🔢 FEITA ✓"}</span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function SondagemHubScreen({ student, onSelect, onBack }: { student: Student; onSelect: (area: Area) => void; onBack: () => void }) {
  const litPending = needsSondagem(student, "literacy");
  const mathPending = needsSondagem(student, "math");
  const litLast = [...student.sondagemHistory].filter(e => e.area === "literacy").pop();
  const mathLast = [...student.sondagemHistory].filter(e => e.area === "math").pop();
  return (
    <div className="min-h-screen flex flex-col" style={{ background:"linear-gradient(145deg,#f0f9ff,#dbeafe,#ede9fe)" }}>
      <div className="p-4">
        <button onClick={onBack} className="text-blue-400 text-sm font-bold hover:text-blue-600 flex items-center gap-1 mb-4" style={{ fontFamily:"Fredoka,sans-serif" }}>← VOLTAR</button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 bg-blue-100 rounded-3xl flex items-center justify-center text-3xl animate-float shadow-md border-4 border-white">🔍</div>
          <div>
            <p className="text-3xl font-bold text-blue-800" style={{ fontFamily:"Fredoka,sans-serif" }}>SONDAGEM</p>
            <p className="text-blue-400 text-sm font-bold">DESCUBRA O QUE VOCÊ JÁ SABE!</p>
          </div>
        </div>
      </div>
      <div className="mx-4 bg-white rounded-2xl px-4 py-3 flex items-center gap-3 mb-4 shadow-md border-2 border-blue-100">
        <span className="text-3xl">{student.emoji}</span>
        <div>
          <p className="text-gray-800 font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>{student.name}</p>
          <p className="text-gray-400 text-xs font-bold">{student.sondagemHistory.length} SONDAGEM(NS) REALIZADA(S)</p>
        </div>
      </div>
      <div className="flex-1 px-4 space-y-4">
        {(["literacy","math"] as const).map((area) => {
          const isPending = area === "literacy" ? litPending : mathPending;
          const last = area === "literacy" ? litLast : mathLast;
          const level = getLevelForArea(student, area);
          const meta = getMeta(area, level);
          return (
            <button key={area} onClick={() => onSelect(area)}
              className="w-full bg-white rounded-3xl border-4 overflow-hidden text-left shadow-lg transition-all active:scale-98"
              style={{ borderColor: isPending ? "#fbbf24" : "#93c5fd" }}>
              <div className={`bg-gradient-to-r ${meta.bg} px-5 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{area==="literacy"?"📚":"🔢"}</span>
                  <span className="text-white font-bold text-base" style={{ fontFamily:"Fredoka,sans-serif" }}>{area==="literacy"?"LEITURA E ESCRITA":"MATEMÁTICA"}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPending?"bg-amber-300 text-amber-900":"bg-white/30 text-white"}`}>
                  {isPending ? "📅 PENDENTE" : "✓ FEITA HOJE"}
                </span>
              </div>
              <div className="p-4">
                <p className="text-gray-700 font-bold text-sm mb-1">NÍVEL: <span style={{ color:meta.solid }}>{meta.name}</span></p>
                <p className="text-gray-400 text-xs font-bold">6 PERGUNTAS · ESCRITA COM ÁUDIO</p>
                {last && <p className="text-xs text-gray-300 mt-1 font-bold">ÚLTIMA: {last.score}/{last.total}</p>}
                <div className={`mt-3 rounded-xl px-3 py-2 flex items-center gap-2 ${isPending?"bg-amber-50 border border-amber-200":"bg-emerald-50 border border-emerald-200"}`}>
                  <span>{isPending ? "🎯" : "✅"}</span>
                  <p className={`text-xs font-bold ${isPending?"text-amber-700":"text-emerald-700"}`}>
                    {isPending ? "SONDAGEM DE HOJE AINDA NÃO FOI FEITA!" : "JÁ FEITA HOJE. PODE FAZER NOVAMENTE!"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
        <div className="bg-white rounded-2xl p-4 flex gap-3 items-start shadow-sm border-2 border-blue-100">
          <span className="text-xl flex-shrink-0">💡</span>
          <p className="text-gray-500 text-xs leading-relaxed font-bold">
            A SONDAGEM AJUDA A PROFESSORA A ENTENDER O QUE VOCÊ JÁ SABE. NÃO É UMA PROVA — ESCREVA DO SEU JEITO, SEM MEDO!
          </p>
        </div>
      </div>
      <div className="pb-8" />
    </div>
  );
}

// ─── Sondagem Screen — Sem feedback de certo/errado para a criança ─────────────

function SondagemScreen({ student, area, onComplete, onSkip }: {
  student: Student; area: Area; onComplete: (results: boolean[], responses: SondagemResponse[]) => void; onSkip: () => void;
}) {
  const level = getLevelForArea(student, area);
  const questions = getSondagem(area, level);
  const [qIdx, setQIdx] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [responses, setResponses] = useState<SondagemResponse[]>([]);
  const [spellVal, setSpellVal] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = getMeta(area, level);
  const q = questions[qIdx];
  if (!q) return null;

  useEffect(() => {
    setSpellVal(""); setAdvancing(false); setSelected(null); setAudioPlayed(false);
    if (q.type === "spell" && q.spoken) {
      const t = setTimeout(() => { speak(q.spoken); setAudioPlayed(true); }, 500);
      const tf = setTimeout(() => inputRef.current?.focus(), 800);
      return () => { clearTimeout(t); clearTimeout(tf); };
    } else if (q.spoken && student.audioEnabled) {
      const t = setTimeout(() => speak(q.spoken), 400);
      return () => clearTimeout(t);
    }
  }, [qIdx]);

  const advance = (correct: boolean, written: string) => {
    if (advancing) return;
    setAdvancing(true);
    const r = [...results, correct];
    const resp: SondagemResponse = { spoken: q.spoken ?? q.instruction ?? "", written: written.trim().toUpperCase() || "—", correct };
    const rs = [...responses, resp];
    setTimeout(() => {
      if (qIdx + 1 >= questions.length) onComplete(r, rs);
      else { setQIdx(qIdx + 1); setResults(r); setResponses(rs); }
    }, 500);
  };

  const handleSpell = () => {
    const input = spellVal.trim().toUpperCase();
    if (!input || advancing) return;
    advance((q.answers ?? []).some((a) => a.toUpperCase() === input), input);
  };

  const handleChoice = (opt: Option) => {
    if (advancing || selected) return;
    setSelected(opt.value);
    advance(opt.correct, opt.label ?? opt.value);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background:"linear-gradient(145deg,#f0f9ff,#dbeafe,#ede9fe)" }}>
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-blue-700 text-base" style={{ fontFamily:"Fredoka,sans-serif" }}>🔍 SONDAGEM</p>
          <p className="text-blue-400 text-xs font-bold">PALAVRA {qIdx+1} DE {questions.length}</p>
        </div>
        <button onClick={onSkip} className="text-gray-300 text-xs font-bold hover:text-gray-400" style={{ fontFamily:"Fredoka,sans-serif" }}>PULAR →</button>
      </div>
      {/* Barra de progresso neutra — sem indicar certo/errado */}
      <div className="px-4 mb-4">
        <div className="flex gap-1.5">
          {questions.map((_,i) => (
            <div key={i} className={`flex-1 h-2.5 rounded-full transition-all ${i < qIdx ? "bg-blue-300" : i===qIdx ? "bg-amber-400 animate-pulse" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center p-4 gap-4">
        {q.type === "spell" ? (
          /* ── SPELL: APENAS ÁUDIO + CAIXA DE TEXTO + TECLADO VIRTUAL ── */
          <div className="w-full max-w-sm space-y-4">
            {/* Cartão de áudio */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-violet-100">
              <div className={`bg-gradient-to-r ${meta.bg} px-4 py-2.5 flex items-center gap-2`}>
                <span className="text-white text-lg">🎵</span>
                <p className="text-white text-sm font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>OUÇA A PALAVRA</p>
              </div>
              <div className="p-5 flex flex-col items-center gap-4">
                <button
                  onClick={() => { speak(q.spoken); setAudioPlayed(true); }}
                  className={`w-full flex flex-col items-center gap-2 py-5 rounded-2xl font-bold text-xl border-4 transition-all active:scale-95 shadow-lg ${audioPlayed ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100" : "text-white border-white/20"}`}
                  style={{ background: audioPlayed ? undefined : meta.solid, fontFamily:"Fredoka,sans-serif" }}>
                  <span className="text-5xl">{audioPlayed ? "🔊" : "🔉"}</span>
                  <span>{audioPlayed ? "OUVIR DE NOVO" : "TOQUE PARA OUVIR"}</span>
                </button>
              </div>
            </div>

            {/* Folha de escrita */}
            {!advancing && (
              <div className="bg-white rounded-3xl shadow-md border-4 border-amber-100 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 flex items-center gap-2">
                  <span className="text-white text-base">✏️</span>
                  <p className="text-white text-xs font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>ESCREVA O QUE VOCÊ OUVIU</p>
                </div>
                <div className="p-4 space-y-3">
                  <div
                    className="rounded-2xl border-4 border-dashed border-amber-300 min-h-[68px] flex items-center justify-center px-4 py-3 cursor-text"
                    style={{ background:"repeating-linear-gradient(transparent,transparent 29px,#fde68a44 29px,#fde68a44 30px),#fffbeb" }}
                    onClick={() => inputRef.current?.focus()}>
                    {spellVal
                      ? <p className="text-3xl font-bold text-gray-800 tracking-widest text-center" style={{ fontFamily:"Fredoka,sans-serif" }}>{spellVal}</p>
                      : <p className="text-amber-300 font-bold text-sm text-center" style={{ fontFamily:"Fredoka,sans-serif" }}>TOQUE AQUI E ESCREVA...</p>}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={spellVal}
                    onChange={(e) => setSpellVal(e.target.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇÄËÏÖÜ]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSpell(); }}
                    maxLength={30}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border-4 border-violet-200 bg-violet-50 text-center text-2xl font-bold text-gray-800 tracking-widest py-3 px-4 outline-none focus:border-violet-500 focus:bg-white transition-all"
                    style={{ fontFamily:"Fredoka,sans-serif", caretColor: meta.solid }}
                    placeholder="DIGITE AQUI..."
                  />
                </div>
              </div>
            )}

            {/* Feedback neutro quando avançando */}
            {advancing && (
              <div className="bg-white rounded-3xl shadow-md border-4 border-blue-100 p-6 flex flex-col items-center gap-2 animate-bounce-in">
                <span className="text-5xl">⭐</span>
                <p className="text-blue-600 font-bold text-lg" style={{ fontFamily:"Fredoka,sans-serif" }}>MUITO BOM! PRÓXIMA...</p>
              </div>
            )}

            {/* Teclado virtual */}
            {!advancing && (
              <div className="bg-white rounded-3xl shadow-md border-2 border-gray-100 p-4">
                <p className="text-center text-gray-400 text-xs font-bold mb-2" style={{ fontFamily:"Fredoka,sans-serif" }}>OU USE O TECLADO:</p>
                <VirtualKeyboard value={spellVal} onChange={setSpellVal} onConfirm={handleSpell} accentColor={meta.solid} />
              </div>
            )}
          </div>
        ) : (
          /* ── CHOICE: sem feedback de certo/errado ── */
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-gray-100">
            <div className={`bg-gradient-to-r ${meta.bg} px-4 py-2 flex items-center gap-2`}>
              <span>{q.tagIcon}</span>
              <span className="text-white text-xs font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>SONDAGEM · {getLevelName(area, level)}</span>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-2 mb-4">
                <p className="flex-1 text-xl font-bold text-gray-800 leading-tight" style={{ fontFamily:"Fredoka,sans-serif" }}>
                  {q.instruction}
                  {q.word && <span className="text-violet-600"> {q.word}</span>}
                </p>
                {q.spoken && student.audioEnabled && <AudioBtn text={q.spoken} audioEnabled={student.audioEnabled} />}
              </div>
              {q.image && <div className="flex justify-center my-3"><span className="text-8xl animate-float">{q.image}</span></div>}
              {q.mathDisplay && (
                <div className="flex justify-center my-3 p-3 bg-gray-50 rounded-2xl">
                  <span className="text-3xl font-bold text-gray-700">{q.mathDisplay}</span>
                </div>
              )}
              {advancing ? (
                <div className="flex justify-center py-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">⭐</span>
                    <p className="text-blue-500 font-bold text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>PRÓXIMA...</p>
                  </div>
                </div>
              ) : (
                q.options && (
                  <div className={`grid gap-3 ${q.options.length<=2?"grid-cols-2":q.options.length===4?"grid-cols-2":"grid-cols-3"}`}>
                    {q.options.map((opt) => (
                      <button key={opt.value} onClick={() => handleChoice(opt)}
                        className={`py-4 px-2 rounded-2xl font-bold text-xl border-4 transition-all active:scale-95 shadow-sm ${selected===opt.value?"bg-blue-100 border-blue-300 text-blue-700 scale-105":"bg-gray-50 border-gray-200 text-gray-800 hover:border-violet-300 hover:bg-violet-50"}`}
                        style={{ fontFamily:"Fredoka,sans-serif" }}>{opt.label}</button>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SondagemResultScreen({ results, area, level, onContinue }: { results: boolean[]; area: Area; level: number; onContinue: () => void }) {
  const score = results.filter(Boolean).length;
  const total = results.length;
  useEffect(() => { speak("Sondagem concluída! Obrigada pela sua participação!"); }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background:"linear-gradient(135deg,#fdf4ff,#ede9fe,#dbeafe)" }}>
      <div className="w-full max-w-sm text-center animate-bounce-in">
        <div className="text-7xl mb-4">🌟</div>
        <p className="text-3xl font-bold text-violet-800 mb-2" style={{ fontFamily:"Fredoka,sans-serif" }}>MUITO BEM!</p>
        <p className="text-lg font-bold text-violet-500 mb-6" style={{ fontFamily:"Fredoka,sans-serif" }}>VOCÊ COMPLETOU A SONDAGEM!</p>
        <div className="bg-white rounded-3xl p-5 mb-6 shadow-lg border-2 border-violet-100">
          <p className="text-sm font-bold text-gray-400 mb-2">PALAVRAS COMPLETADAS</p>
          <p className="text-5xl font-bold text-violet-700 mb-1" style={{ fontFamily:"Fredoka,sans-serif" }}>{total}</p>
          <p className="text-xs text-gray-400 font-bold">RESULTADO ENVIADO PARA A PROFESSORA</p>
        </div>
        <button onClick={onContinue}
          className="w-full py-4 rounded-2xl font-bold text-xl text-white shadow-lg active:scale-95 transition-all bg-violet-500 hover:bg-violet-600"
          style={{ fontFamily:"Fredoka,sans-serif" }}>
          PRONTO! VOLTAR 🎮
        </button>
      </div>
    </div>
  );
}

// ─── Alphabet Screen ──────────────────────────────────────────

type AlphabetTab = "explore" | "missing" | "anagram";

function AlphabetScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<AlphabetTab>("explore");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // Missing letter state
  const [missingPool] = useState(() => shuffle(ALPHABET_MISSING).slice(0, 8));
  const [mIdx, setMIdx] = useState(0);
  const [mSelected, setMSelected] = useState<string | null>(null);
  const [mErrors, setMErrors] = useState(0);
  const [mAnswered, setMAnswered] = useState(false);
  const [mRevealedAnswer, setMRevealedAnswer] = useState<string | null>(null);
  const [mScore, setMScore] = useState(0);
  const [mDone, setMDone] = useState(false);
  const curM = missingPool[mIdx];

  // Anagram state
  const [anagramPool] = useState(() => shuffle(ALPHABET_ANAGRAMS).slice(0, 8));
  const [aIdx, setAIdx] = useState(0);
  const [aLetters, setALetters] = useState<string[]>([]);
  const [aTyped, setATyped] = useState<string[]>([]);
  const [aErrors, setAErrors] = useState(0);
  const [aAnswered, setAAnswered] = useState(false);
  const [aRevealedWord, setARevealedWord] = useState<string | null>(null);
  const [aScore, setAScore] = useState(0);
  const [aDone, setADone] = useState(false);
  const curA = anagramPool[aIdx];

  useEffect(() => {
    if (curA) setALetters(shuffle(curA.word.split("")));
  }, [aIdx]);

  useEffect(() => { const t = setTimeout(() => speak("Explore o alfabeto!"), 500); return () => clearTimeout(t); }, []);

  const handleLetter = (l: string) => { setActiveLetter(l); speak(LETTER_PHONEMES[l] ?? l); };

  // Missing letter handlers
  const goNextM = () => {
    if (mIdx + 1 >= missingPool.length) setMDone(true);
    else {
      setMIdx(i => i + 1);
      setMSelected(null); setMErrors(0); setMAnswered(false); setMRevealedAnswer(null);
    }
  };

  const handleMChoice = (opt: string) => {
    if (mAnswered) return;
    setMSelected(opt);
    if (opt === curM.answer) {
      speak("Muito bem! Você acertou!");
      setMScore(s => s + 1);
      setMAnswered(true);
      setTimeout(goNextM, 900);
    } else {
      const e = mErrors + 1;
      setMErrors(e);
      if (e >= 2) {
        speak("A letra que faltava era " + curM.answer);
        setMRevealedAnswer(curM.answer);
        setMAnswered(true);
        setTimeout(goNextM, 2200);
      } else {
        speak("Quase! Tente mais uma vez!");
        setTimeout(() => setMSelected(null), 700);
      }
    }
  };
  const restartM = () => { setMIdx(0); setMSelected(null); setMErrors(0); setMAnswered(false); setMRevealedAnswer(null); setMScore(0); setMDone(false); };

  // Anagram handlers
  const goNextA = () => {
    if (aIdx + 1 >= anagramPool.length) setADone(true);
    else {
      setAIdx(i => i + 1);
      setATyped([]); setAErrors(0); setAAnswered(false); setARevealedWord(null);
    }
  };

  const handleATap = (letter: string, fromIdx: number) => {
    if (aAnswered) return;
    setATyped(prev => [...prev, letter]);
    setALetters(prev => { const next = [...prev]; next.splice(fromIdx, 1); return next; });
  };
  const handleARemove = (idx: number) => {
    if (aAnswered) return;
    const letter = aTyped[idx];
    setALetters(prev => [...prev, letter]);
    setATyped(prev => { const next = [...prev]; next.splice(idx, 1); return next; });
  };
  const handleAConfirm = () => {
    if (aAnswered || aTyped.length < curA.word.length) return;
    const formed = aTyped.join("");
    if (formed === curA.word) {
      speak("Parabéns! Você formou a palavra!");
      setAScore(s => s + 1);
      setAAnswered(true);
      setTimeout(goNextA, 1000);
    } else {
      const e = aErrors + 1;
      setAErrors(e);
      if (e >= 2) {
        speak("A palavra era: " + curA.word);
        setARevealedWord(curA.word);
        setAAnswered(true);
        setTimeout(goNextA, 2200);
      } else {
        speak("Quase! Tente de novo!");
        setALetters(shuffle(curA.word.split("")));
        setATyped([]);
      }
    }
  };
  const restartA = () => { setAIdx(0); setATyped([]); setAErrors(0); setAAnswered(false); setARevealedWord(null); setAScore(0); setADone(false); };

  const TABS: { key: AlphabetTab; label: string }[] = [
    { key:"explore", label:"🔡 EXPLORAR" },
    { key:"missing", label:"❓ FALTA LETRA" },
    { key:"anagram", label:"🔀 EMBARALHAR" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background:"linear-gradient(145deg,#fffbeb,#fef9c3,#fefce8)" }}>
      <div className="p-4">
        <button onClick={onBack} className="text-amber-500 text-sm font-bold hover:text-amber-700 flex items-center gap-1 mb-3" style={{ fontFamily:"Fredoka,sans-serif" }}>← VOLTAR</button>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-amber-100 rounded-3xl flex items-center justify-center text-3xl shadow-md border-4 border-white animate-float">🔡</div>
          <div>
            <p className="text-3xl font-bold text-amber-800" style={{ fontFamily:"Fredoka,sans-serif" }}>ALFABETO</p>
            <p className="text-amber-500 text-sm font-bold">TOQUE NAS LETRAS PARA OUVIR!</p>
          </div>
        </div>
      </div>
      <div className="flex mx-4 mb-4 bg-white rounded-2xl border-2 border-amber-100 overflow-hidden shadow-sm">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 font-bold text-xs transition-all ${tab===t.key?"bg-amber-400 text-white":"text-gray-400 hover:text-amber-500"}`}
            style={{ fontFamily:"Fredoka,sans-serif" }}>{t.label}</button>
        ))}
      </div>

      {/* EXPLORAR */}
      {tab === "explore" && (
        <div className="flex-1 px-4 pb-6">
          {activeLetter && (
            <div className="mb-4 bg-white rounded-3xl p-4 flex items-center gap-4 shadow-lg border-4 border-amber-200 animate-bounce-in">
              <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-5xl font-bold text-amber-700" style={{ fontFamily:"Fredoka,sans-serif" }}>{activeLetter}</span>
              </div>
              <div>
                <p className="text-gray-400 text-xs font-bold mb-0.5">NOME DA LETRA</p>
                <p className="text-3xl font-bold text-amber-600" style={{ fontFamily:"Fredoka,sans-serif" }}>{(LETTER_PHONEMES[activeLetter]??"").toUpperCase()}</p>
                <button onClick={() => speak(LETTER_PHONEMES[activeLetter]??activeLetter)}
                  className="mt-2 px-3 py-1 rounded-full bg-amber-400 text-white text-xs font-bold hover:bg-amber-500 active:scale-95 transition-all"
                  style={{ fontFamily:"Fredoka,sans-serif" }}>🔊 OUVIR DE NOVO</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-5 gap-2">
            {ALPHABET_LETTERS.map((letter) => (
              <button key={letter} onClick={() => handleLetter(letter)}
                className={`aspect-square rounded-2xl flex items-center justify-center font-bold text-2xl border-4 transition-all active:scale-90 shadow-sm ${activeLetter===letter?"bg-amber-400 border-amber-500 text-white scale-110 shadow-lg":"bg-white border-amber-100 text-gray-700 hover:border-amber-300 hover:bg-amber-50"}`}
                style={{ fontFamily:"Fredoka,sans-serif" }}>{letter}</button>
            ))}
          </div>
        </div>
      )}

      {/* FALTA LETRA */}
      {tab === "missing" && (
        <div className="flex-1 px-4 pb-6">
          {mDone ? (
            <div className="bg-white rounded-3xl p-6 text-center shadow-xl border-4 border-amber-200 animate-bounce-in">
              <div className="text-6xl mb-3">{mScore >= 7 ? "🏆" : mScore >= 5 ? "⭐" : "🌱"}</div>
              <p className="text-3xl font-bold text-amber-700 mb-2" style={{ fontFamily:"Fredoka,sans-serif" }}>PARABÉNS!</p>
              <p className="text-xl font-bold text-gray-500 mb-4" style={{ fontFamily:"Fredoka,sans-serif" }}>VOCÊ ACERTOU {mScore} DE {missingPool.length}!</p>
              <button onClick={restartM} className="w-full py-3 rounded-2xl bg-amber-400 text-white font-bold text-lg hover:bg-amber-500 active:scale-95 transition-all shadow-md" style={{ fontFamily:"Fredoka,sans-serif" }}>TENTAR DE NOVO 🔄</button>
            </div>
          ) : (
            <div>
              <div className="flex gap-1.5 mb-4">
                {missingPool.map((_,i)=><div key={i} className={`flex-1 h-2.5 rounded-full ${i<mIdx?"bg-emerald-400":i===mIdx?"bg-amber-400":"bg-gray-200"}`} />)}
              </div>
              {/* Reveal banner — prominent when answer revealed */}
              {mRevealedAnswer && (
                <div className="mb-3 bg-violet-100 border-4 border-violet-400 rounded-2xl p-4 flex flex-col items-center gap-2 animate-bounce-in shadow-lg">
                  <span className="text-3xl">✨</span>
                  <p className="text-sm font-bold text-violet-700" style={{ fontFamily:"Fredoka,sans-serif" }}>A LETRA QUE FALTAVA ERA:</p>
                  <div className="w-16 h-16 bg-violet-500 rounded-2xl flex items-center justify-center shadow-md">
                    <span className="text-4xl font-bold text-white" style={{ fontFamily:"Fredoka,sans-serif" }}>{mRevealedAnswer}</span>
                  </div>
                  <p className="text-xs text-violet-500 font-bold">VAMOS CONTINUAR!</p>
                </div>
              )}
              {mErrors === 1 && !mRevealedAnswer && (
                <div className="mb-3 bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 flex items-center gap-2 animate-slide-up">
                  <span className="text-xl">💡</span>
                  <p className="text-sm font-bold text-amber-700" style={{ fontFamily:"Fredoka,sans-serif" }}>OLHA A SEQUÊNCIA COM ATENÇÃO E TENTA DE NOVO!</p>
                </div>
              )}
              <div className="bg-white rounded-3xl shadow-xl border-4 border-amber-100 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2">
                  <p className="text-white font-bold text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>❓ QUAL LETRA ESTÁ FALTANDO?</p>
                </div>
                <div className="p-5">
                  <div className="flex justify-center gap-2 mb-6">
                    {curM.sequence.map((l,i) => (
                      <div key={i}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold border-4 shadow-sm transition-all ${
                          l==="_"
                            ? mRevealedAnswer
                              ? "bg-violet-500 border-violet-600 text-white scale-110 shadow-violet-200"
                              : "border-dashed border-amber-400 bg-amber-50 text-amber-400 animate-pulse"
                            : "bg-amber-50 border-amber-200 text-amber-700"}`}
                        style={{ fontFamily:"Fredoka,sans-serif" }}>
                        {l==="_" ? (mRevealedAnswer ?? "?") : l}
                      </div>
                    ))}
                  </div>
                  {!mRevealedAnswer && (
                    <div className="grid grid-cols-3 gap-3">
                      {curM.options.map((opt) => {
                        const isSel = mSelected===opt;
                        const isCorrect = opt===curM.answer && mAnswered;
                        return (
                          <button key={opt} onClick={() => handleMChoice(opt)} disabled={mAnswered}
                            className={`py-4 rounded-2xl font-bold text-3xl border-4 transition-all active:scale-95 shadow-sm ${
                              isCorrect ? "bg-emerald-400 border-emerald-500 text-white scale-105"
                              : isSel && !mAnswered ? "bg-red-100 border-red-300 text-red-500 animate-shake"
                              : "bg-white border-amber-100 text-gray-700 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"}`}
                            style={{ fontFamily:"Fredoka,sans-serif" }}>{opt}</button>
                        );
                      })}
                    </div>
                  )}
                  {mErrors > 0 && !mRevealedAnswer && (
                    <p className="text-center text-xs text-amber-500 font-bold mt-3" style={{ fontFamily:"Fredoka,sans-serif" }}>
                      TENTATIVA {mErrors}/2 — {2 - mErrors} CHANCE{2-mErrors!==1?"S":""} RESTANTE{2-mErrors!==1?"S":""}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-center text-gray-300 text-sm font-bold mt-3" style={{ fontFamily:"Fredoka,sans-serif" }}>EXERCÍCIO {mIdx+1} DE {missingPool.length}</p>
            </div>
          )}
        </div>
      )}

      {/* EMBARALHAR */}
      {tab === "anagram" && (
        <div className="flex-1 px-4 pb-6">
          {aDone ? (
            <div className="bg-white rounded-3xl p-6 text-center shadow-xl border-4 border-amber-200 animate-bounce-in">
              <div className="text-6xl mb-3">{aScore >= 7 ? "🏆" : aScore >= 5 ? "⭐" : "🌱"}</div>
              <p className="text-3xl font-bold text-amber-700 mb-2" style={{ fontFamily:"Fredoka,sans-serif" }}>MUITO BEM!</p>
              <p className="text-xl font-bold text-gray-500 mb-4" style={{ fontFamily:"Fredoka,sans-serif" }}>VOCÊ ACERTOU {aScore} DE {anagramPool.length}!</p>
              <button onClick={restartA} className="w-full py-3 rounded-2xl bg-amber-400 text-white font-bold text-lg hover:bg-amber-500 active:scale-95 transition-all shadow-md" style={{ fontFamily:"Fredoka,sans-serif" }}>TENTAR DE NOVO 🔄</button>
            </div>
          ) : (
            <div>
              <div className="flex gap-1.5 mb-4">
                {anagramPool.map((_,i)=><div key={i} className={`flex-1 h-2.5 rounded-full ${i<aIdx?"bg-emerald-400":i===aIdx?"bg-amber-400":"bg-gray-200"}`} />)}
              </div>
              {/* Reveal banner */}
              {aRevealedWord && (
                <div className="mb-3 bg-violet-100 border-4 border-violet-400 rounded-2xl p-4 flex flex-col items-center gap-2 animate-bounce-in shadow-lg">
                  <span className="text-3xl">✨</span>
                  <p className="text-sm font-bold text-violet-700" style={{ fontFamily:"Fredoka,sans-serif" }}>A PALAVRA ERA:</p>
                  <div className="flex gap-1.5">
                    {aRevealedWord.split("").map((l, i) => (
                      <div key={i} className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center shadow-md">
                        <span className="text-2xl font-bold text-white" style={{ fontFamily:"Fredoka,sans-serif" }}>{l}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-violet-500 font-bold">VAMOS CONTINUAR!</p>
                </div>
              )}
              {aErrors === 1 && !aRevealedWord && (
                <div className="mb-3 bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 flex items-center gap-2 animate-slide-up">
                  <span className="text-xl">💡</span>
                  <p className="text-sm font-bold text-amber-700" style={{ fontFamily:"Fredoka,sans-serif" }}>QUASE! AS LETRAS FORAM EMBARALHADAS — TENTE NOVAMENTE!</p>
                </div>
              )}
              <div className="bg-white rounded-3xl shadow-xl border-4 border-amber-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-4 py-2 flex items-center justify-between">
                  <p className="text-white font-bold text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>🔀 COLOQUE AS LETRAS EM ORDEM!</p>
                  <span className="text-white text-sm">{curA.hint}</span>
                </div>
                <div className="p-5">
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-400 mb-2 text-center" style={{ fontFamily:"Fredoka,sans-serif" }}>SUA RESPOSTA (TOQUE PARA REMOVER):</p>
                    <div className="flex justify-center gap-2 min-h-[52px] flex-wrap">
                      {aTyped.length === 0
                        ? <div className="flex-1 h-12 rounded-xl border-4 border-dashed border-gray-200 flex items-center justify-center"><p className="text-gray-300 text-xs font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>TOQUE NAS LETRAS ABAIXO</p></div>
                        : aTyped.map((l, i) => (
                          <button key={i} onClick={() => handleARemove(i)} disabled={aAnswered}
                            className="w-12 h-12 rounded-xl bg-violet-100 border-4 border-violet-300 text-violet-700 text-2xl font-bold hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all"
                            style={{ fontFamily:"Fredoka,sans-serif" }}>{l}</button>
                        ))}
                    </div>
                  </div>
                  {!aRevealedWord && (
                    <>
                      <div className="mb-4">
                        <p className="text-xs font-bold text-gray-400 mb-2 text-center" style={{ fontFamily:"Fredoka,sans-serif" }}>LETRAS DISPONÍVEIS:</p>
                        <div className="flex justify-center gap-2 flex-wrap">
                          {aLetters.map((l, i) => (
                            <button key={i} onClick={() => handleATap(l, i)} disabled={aAnswered}
                              className="w-12 h-12 rounded-xl bg-amber-100 border-4 border-amber-300 text-amber-700 text-2xl font-bold hover:bg-amber-200 active:scale-90 transition-all disabled:opacity-40"
                              style={{ fontFamily:"Fredoka,sans-serif" }}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {!aAnswered && (
                        <div className="flex gap-2">
                          <button onClick={() => { setALetters(shuffle(curA.word.split(""))); setATyped([]); }}
                            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-400 text-sm font-bold hover:bg-gray-50 active:scale-95 transition-all"
                            style={{ fontFamily:"Fredoka,sans-serif" }}>↺ RESETAR</button>
                          <button onClick={handleAConfirm} disabled={aTyped.length < curA.word.length}
                            className="flex-1 py-2.5 rounded-xl bg-amber-400 text-white text-sm font-bold hover:bg-amber-500 active:scale-95 transition-all disabled:opacity-40 shadow-md"
                            style={{ fontFamily:"Fredoka,sans-serif" }}>✓ CONFIRMAR</button>
                        </div>
                      )}
                      {aErrors > 0 && !aRevealedWord && (
                        <p className="text-center text-xs text-amber-500 font-bold mt-3" style={{ fontFamily:"Fredoka,sans-serif" }}>
                          TENTATIVA {aErrors}/2 — {2 - aErrors} CHANCE{2-aErrors!==1?"S":""} RESTANTE{2-aErrors!==1?"S":""}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <p className="text-center text-gray-300 text-sm font-bold mt-3" style={{ fontFamily:"Fredoka,sans-serif" }}>EXERCÍCIO {aIdx+1} DE {anagramPool.length}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Game Screen ──────────────────────────────────────────────

function GameScreen({ student, area, activityIndex, onResult, onSkipToNext, onBack }: {
  student: Student; area: Area; activityIndex: number;
  onResult: (correct: boolean, usedHint: boolean) => void; onSkipToNext: () => void; onBack: () => void;
}) {
  const level = getLevelForArea(student, area);
  const pool = getActivities(area, level);
  const activity = pool[activityIndex % pool.length];
  const meta = getMeta(area, level);
  const hasAudio = student.audioEnabled && area === "literacy" && level <= AUDIO_LITERACY_MAX;
  const missionsDone = area === "literacy" ? student.literacyMissionsDone : student.mathMissionsDone;

  const [phase, setPhase] = useState<GamePhase>("playing");
  const [errorCount, setErrorCount] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [writeVal, setWriteVal] = useState("");
  const [shaking, setShaking] = useState(false);
  const [wrongMsg] = useState(() => WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)]);
  const [hintMsgSet] = useState(() => HINT_MSGS[Math.floor(Math.random() * HINT_MSGS.length)]);

  useEffect(() => {
    if (hasAudio && activity.spoken) { const t = setTimeout(() => speak(activity.spoken), 500); return () => { clearTimeout(t); stopSpeech(); }; }
    return () => stopSpeech();
  }, [activity.spoken, hasAudio]);

  const visibleOptions = activity.options
    ? hintLevel >= 2 ? activity.options.filter((o,i) => o.correct || i===0).slice(0,2) : activity.options
    : [];

  const handleWrong = () => {
    const n = errorCount + 1; setErrorCount(n);
    if (n >= 2) { setPhase("revealed"); if (hasAudio) speak("Vamos ver a resposta certa juntos!"); }
    else { setPhase("wrong1"); setShaking(true); if (hasAudio) speak(["Quase! Tente mais uma vez!","Você está quase lá!","Presta atenção e tenta de novo!"][Math.floor(Math.random()*3)]); setTimeout(() => { setShaking(false); setSelected(null); setPhase("playing"); }, 900); }
  };

  const handleChoice = (opt: Option) => {
    if (selected || phase === "revealed") return;
    setSelected(opt.value);
    if (opt.correct) { if (hasAudio) speak("Muito bem! Você acertou!"); setTimeout(() => onResult(true, hintLevel > 0), 650); }
    else handleWrong();
  };

  const handleWrite = () => {
    const input = writeVal.trim().toUpperCase();
    const correct = (activity.answers ?? []).some((a) => a.toUpperCase() === input);
    if (correct) { if (hasAudio) speak("Incrível! Você escreveu certo!"); onResult(true, hintLevel > 0); }
    else { handleWrong(); if (phase !== "revealed") setWriteVal(""); }
  };

  const isWriteType = activity.type === "write" || activity.type === "spell";

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: meta.pastelBg }}>
      <div className={`bg-gradient-to-r ${meta.bg} px-4 py-3 flex items-center justify-between shadow-md`}>
        <button onClick={() => { stopSpeech(); onBack(); }}
          className="flex items-center gap-1.5 bg-white/20 backdrop-blur text-white px-3 py-2 rounded-full text-sm font-bold hover:bg-white/30 transition-all flex-shrink-0"
          style={{ fontFamily:"Fredoka,sans-serif" }}>← SAIR</button>
        <div className="flex flex-col items-center gap-0.5 flex-1 mx-2">
          <span className="text-white/80 text-xs font-bold">{area==="literacy"?"📚 LEITURA E ESCRITA":"🔢 MATEMÁTICA"}</span>
          <div className="flex gap-1">
            {Array.from({length:MISSIONS_REQUIRED}).map((_,i)=><div key={i} className={`h-2.5 w-6 rounded-full ${i<missionsDone?"bg-white":"bg-white/30"}`} />)}
          </div>
          <span className="text-white/60 text-xs font-bold">{missionsDone}/{MISSIONS_REQUIRED} MISSÕES</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl">{student.emoji}</span>
          <div className="text-right">
            <div className="text-white font-bold text-sm leading-none" style={{ fontFamily:"Fredoka,sans-serif" }}>{student.name}</div>
            <div className="text-xs font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 bg-white/30 text-white">NV.{level}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-start p-4 gap-4 overflow-y-auto">
        <div className={`w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border-2 ${shaking?"animate-shake":""}`} style={{ borderColor: meta.pastelBorder }}>
          <div className={`bg-gradient-to-r ${meta.bg} px-4 py-2 flex items-center justify-between`}>
            <div className="flex items-center gap-1.5">
              <span>{activity.tagIcon}</span>
              <span className="text-white text-xs font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>{activity.tag}</span>
            </div>
            <span className="text-white text-xs font-bold opacity-70">{meta.name} {meta.mascot}</span>
          </div>
          <div className="p-5">
            {errorCount > 0 && phase === "playing" && (
              <div className="animate-slide-up bg-red-50 border-2 border-red-200 rounded-2xl p-3 mb-3 flex items-center gap-2">
                <span className="text-xl">😅</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-600" style={{ fontFamily:"Fredoka,sans-serif" }}>{wrongMsg}</p>
                  <div className="flex gap-1 mt-1">{[0,1].map((i)=><div key={i} className={`h-2 flex-1 rounded-full ${i<errorCount?"bg-red-400":"bg-gray-200"}`} />)}</div>
                </div>
                <span className="text-xs text-red-400 font-bold">{2-errorCount}×</span>
              </div>
            )}
            {phase === "revealed" ? (
              <RevealCard activity={activity} onNext={() => { stopSpeech(); onSkipToNext(); }} />
            ) : (
              <>
                <div className="flex items-start gap-2 mb-3">
                  <p className="flex-1 text-xl font-bold text-gray-800 leading-tight" style={{ fontFamily:"Fredoka,sans-serif" }}>
                    {activity.instruction}
                    {activity.target && <span className={` ${meta.text}`}> {activity.target}</span>}
                    {activity.word && <span className={` ${meta.text}`}> {activity.word}</span>}
                  </p>
                  {hasAudio && activity.spoken && <AudioBtn text={activity.spoken} audioEnabled={student.audioEnabled} />}
                </div>
                {activity.mathDisplay && (
                  <div className="flex justify-center my-3 p-3 rounded-2xl" style={{ background:meta.pastelBg }}>
                    <span className="text-3xl font-bold text-gray-700 text-center leading-relaxed">{activity.mathDisplay}</span>
                  </div>
                )}
                {activity.image && <div className="flex justify-center my-3"><span className="text-8xl animate-float">{activity.image}</span></div>}
                {hintLevel >= 1 && (
                  <div className="mb-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2 animate-slide-up">
                    <span>💡</span>
                    <p className="text-sm font-bold text-amber-700 flex-1">{hintMsgSet[Math.min(hintLevel-1, 2)]}</p>
                  </div>
                )}
                {isWriteType && (
                  <div className="rounded-2xl border-4 border-dashed border-amber-300 min-h-[60px] flex items-center justify-center px-4 py-3 mb-3"
                    style={{ background:"repeating-linear-gradient(transparent,transparent 29px,#fde68a44 29px,#fde68a44 30px),#fffbeb" }}>
                    {writeVal ? <p className="text-2xl font-bold text-gray-800 tracking-widest" style={{ fontFamily:"Fredoka,sans-serif" }}>{writeVal}</p> : <p className="text-amber-300 font-bold text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>ESCREVA A PALAVRA...</p>}
                  </div>
                )}
                {activity.type === "choice" && visibleOptions.length > 0 && (
                  <div className={`grid gap-3 ${visibleOptions.length<=2?"grid-cols-2":visibleOptions.length===4?"grid-cols-2":"grid-cols-3"}`}>
                    {visibleOptions.map((opt) => {
                      const isSel = selected===opt.value; const isOk = isSel&&opt.correct;
                      return (
                        <button key={opt.value} onClick={() => handleChoice(opt)}
                          className={`py-4 px-2 rounded-2xl font-bold text-xl border-4 transition-all active:scale-95 shadow-sm ${isOk?"bg-emerald-400 border-emerald-500 text-white scale-105":isSel?"bg-red-100 border-red-300 text-red-500":"bg-white text-gray-800 hover:scale-105"}`}
                          style={{ borderColor:(!isSel)?meta.pastelBorder:undefined, fontFamily:"Fredoka,sans-serif" }}>{opt.label}</button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          {phase !== "revealed" && hintLevel < 3 && (
            <div className="px-5 pb-5">
              <button onClick={() => setHintLevel(h=>Math.min(h+1,3))}
                className="w-full py-2 rounded-xl text-sm font-bold border-2 transition-all"
                style={{ color:meta.pastelText, borderColor:meta.pastelBorder, background:meta.pastelBg, fontFamily:"Fredoka,sans-serif" }}>
                💡 PRECISO DE UMA DICA {hintLevel > 0 ? `(${hintLevel}/3)` : ""}
              </button>
            </div>
          )}
        </div>
        {isWriteType && phase !== "revealed" && (
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg border-2 border-gray-100 p-4">
            <VirtualKeyboard value={writeVal} onChange={setWriteVal} onConfirm={handleWrite} accentColor={meta.solid} />
          </div>
        )}
      </div>
      <div className="flex justify-center pb-4">
        <Stars count={area==="literacy"?student.literacyStars:student.mathStars} size="text-xl" />
      </div>
    </div>
  );
}

function FeedbackScreen({ correct, missionsDoneAfter, area, onContinue }: {
  correct: boolean; missionsDoneAfter: number; area: Area; onContinue: () => void;
}) {
  const [showStars, setShowStars] = useState(false);
  const allDone = missionsDoneAfter >= MISSIONS_REQUIRED;
  const wrongMessages = [
    { msg:"QUASE LÁ! VOCÊ ESTÁ EVOLUINDO! 💪", icon:"😤" },
    { msg:"NÃO DESISTA! CADA ERRO É UMA AULA! 📚", icon:"🌱" },
    { msg:"RESPIRA FUNDO E TENTA DE NOVO! 🌈", icon:"😊" },
    { msg:"VOCÊ CONSEGUE! EU ACREDITO EM VOCÊ! ⭐", icon:"🦋" },
    { msg:"ERRANDO TAMBÉM SE APRENDE! CONTINUE! 🚀", icon:"🎯" },
  ];
  const [wm] = useState(() => wrongMessages[Math.floor(Math.random()*wrongMessages.length)]);
  useEffect(() => { const t = setTimeout(() => setShowStars(true), 250); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (correct) speak(allDone ? "Parabéns! Você completou todas as missões deste nível!" : "Muito bem! Missão concluída!");
    else speak(["Quase lá! Continue tentando!","Não desista, você consegue!","Errando também se aprende!"][Math.floor(Math.random()*3)]);
  }, []);
  const bgColor = correct ? (allDone ? "#7c3aed" : "#059669") : "#d97706";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background:`linear-gradient(135deg,${bgColor}11,${bgColor}06)`, borderTop:`6px solid ${bgColor}` }}>
      {correct && allDone && <Confetti />}
      <div className="relative z-10 text-center animate-bounce-in max-w-sm w-full">
        <div className="text-8xl mb-4">{correct ? (allDone ? "🎉" : "⭐") : wm.icon}</div>
        <p className="text-3xl font-bold mb-3 leading-tight" style={{ fontFamily:"Fredoka,sans-serif", color:bgColor }}>
          {correct ? (allDone ? "NÍVEL CONCLUÍDO!" : "MISSÃO CONCLUÍDA!") : wm.msg}
        </p>
        {correct && (
          <div className="flex justify-center gap-2 my-3">
            {[1,2,3].map((i) => (
              <span key={i} className="text-4xl animate-star-pop" style={{ animationDelay:`${i*0.15}s`, opacity:showStars?1:0 }}>⭐</span>
            ))}
          </div>
        )}
        {correct && !allDone && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-md border-2" style={{ borderColor:`${bgColor}33` }}>
            <p className="text-sm font-bold text-gray-400 mb-2">PROGRESSO NO NÍVEL</p>
            <div className="flex justify-center gap-1.5">
              {Array.from({length:MISSIONS_REQUIRED}).map((_,i)=>(
                <div key={i} className={`h-3 w-8 rounded-full ${i<missionsDoneAfter?"bg-emerald-400":"bg-gray-100"}`} />
              ))}
            </div>
            <p className="text-xs mt-1 text-gray-400 font-bold">{missionsDoneAfter} DE {MISSIONS_REQUIRED} MISSÕES</p>
          </div>
        )}
        {correct && allDone && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-md border-2" style={{ borderColor:`${bgColor}33` }}>
            <p className="text-2xl font-bold mb-1" style={{ fontFamily:"Fredoka,sans-serif", color:bgColor }}>🏆 NÍVEL COMPLETO!</p>
            <p className="text-sm text-gray-400 font-bold">CONTINUE PRATICANDO ENQUANTO AGUARDA!</p>
          </div>
        )}
        {!correct && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-md border-2" style={{ borderColor:`${bgColor}33` }}>
            <p className="text-sm text-gray-500 font-bold">TENTE NOVAMENTE — VOCÊ ESTÁ APRENDENDO! 🌟</p>
          </div>
        )}
        <button onClick={onContinue}
          className="w-full py-4 rounded-2xl font-bold text-xl text-white shadow-lg active:scale-95 transition-all"
          style={{ fontFamily:"Fredoka,sans-serif", background:bgColor }}>
          {correct ? "CONTINUAR →" : "TENTAR NOVAMENTE 🔄"}
        </button>
      </div>
    </div>
  );
}

// ─── Teacher Screens ──────────────────────────────────────────

function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-bold text-gray-500" style={{ fontFamily:"Fredoka,sans-serif" }}>{label}</span>
        <span className="text-xs font-bold text-violet-600">{value}%</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all" style={{ width:`${value}%` }} />
      </div>
    </div>
  );
}

function NotificationsPanel({ notifications, onDismiss, onDismissAll, onPromote }: {
  notifications: TeacherNotification[]; onDismiss: (id: number) => void; onDismissAll: () => void;
  onPromote: (studentId: number, area: Area, notifId: number) => void;
}) {
  if (notifications.length === 0) return (
    <div className="text-center py-6">
      <span className="text-3xl block mb-2">🔔</span>
      <p className="text-gray-400 font-bold text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>NENHUMA NOTIFICAÇÃO</p>
    </div>
  );
  const unread = notifications.filter(n => !n.read);
  return (
    <div className="space-y-3">
      {unread.length > 0 && (
        <div className="flex justify-end">
          <button onClick={onDismissAll} className="text-xs font-bold text-violet-500 hover:text-violet-700 underline" style={{ fontFamily:"Fredoka,sans-serif" }}>DESCARTAR TODAS</button>
        </div>
      )}
      {notifications.map((n) => {
        const isDown = n.direction === "down";
        const isUp = n.direction === "up";
        const isComplete = n.direction === "complete" || !n.direction;
        const cardBg = n.read ? "bg-gray-50 border-gray-100" : isDown ? "bg-orange-50 border-orange-200" : isUp ? "bg-emerald-50 border-emerald-200" : "bg-violet-50 border-violet-200";
        const icon = isDown ? "⬇️" : isUp ? "⬆️" : "🏅";
        const areaLabel = n.area === "literacy" ? "LEITURA" : "MATEMÁTICA";
        const actionText = isDown ? `REGREDIDO EM ${areaLabel}` : isUp ? `AVANÇADO EM ${areaLabel}` : `COMPLETOU AS MISSÕES EM ${areaLabel}`;
        const textColor = isDown ? "text-orange-600" : isUp ? "text-emerald-600" : "text-violet-600";
        const canAdvance = isComplete && ((n.area === "literacy" && n.level < LITERACY_MAX_LEVEL) || (n.area === "math" && n.level < MATH_MAX_LEVEL));
        return (
          <div key={n.id} className={`rounded-2xl p-4 border-2 flex flex-col gap-2 ${cardBg}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{n.studentEmoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-800 text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>{n.studentName}</p>
                  {!n.read && <span className="w-2 h-2 bg-violet-500 rounded-full inline-block flex-shrink-0" />}
                  <span className="text-base leading-none">{icon}</span>
                </div>
                <p className={`text-xs font-bold mt-0.5 ${textColor}`}>{actionText}</p>
                <p className="text-xs text-gray-400 font-bold">NÍVEL ATUAL: {n.levelName}</p>
                <p className="text-xs text-gray-300 mt-0.5">{n.date}</p>
              </div>
              <button onClick={() => onDismiss(n.id)} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0 transition-colors">×</button>
            </div>
            {canAdvance && (
              <button
                onClick={() => onPromote(n.studentId, n.area, n.id)}
                className="w-full py-2 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600 active:scale-95 transition-all shadow-sm"
                style={{ fontFamily:"Fredoka,sans-serif" }}>
                🚀 AVANÇAR {n.studentName} DE NÍVEL AGORA
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const STUDENT_EMOJIS = ["🦋","🐯","🐸","🦁","🦄","🚀","🐱","🐶","🐨","🐵","🐧","🦊","🐢","🐝","🌟","🐙", "🐺", "🦒", "🐷", "🐮",
  "🦝", "🐭", "🐗", "🐹", "🐰", "🐻", "🐼", "🦉", "🐞", "🦩", "🦜", "🦑", "🦓", "🐲"];

function AddStudentForm({ existingNames, onAdd, onCancel }: {
  existingNames: string[]; onAdd: (name: string, emoji: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(STUDENT_EMOJIS[0]);
  const [error, setError] = useState("");

  const submit = () => {
    const clean = name.trim().toUpperCase();
    if (clean.length < 2) { setError("DIGITE UM NOME COM PELO MENOS 2 LETRAS"); return; }
    if (existingNames.includes(clean)) { setError("JÁ EXISTE UM ALUNO COM ESSE NOME"); return; }
    onAdd(clean, emoji);
  };

  return (
    <div className="mx-4 mt-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-gray-800 text-base" style={{ fontFamily:"Fredoka,sans-serif" }}>➕ CADASTRAR ALUNO</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
      </div>
      <label className="block text-xs font-bold text-gray-500 mb-1" style={{ fontFamily:"Fredoka,sans-serif" }}>NOME DO ALUNO</label>
      <input value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="EX: BEATRIZ" maxLength={16}
        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-800 font-bold text-base uppercase outline-none focus:border-violet-400 transition-all"
        style={{ fontFamily:"Fredoka,sans-serif" }} />
      <p className="text-xs font-bold text-gray-500 mt-3 mb-2" style={{ fontFamily:"Fredoka,sans-serif" }}>ESCOLHA UM AVATAR</p>
      <div className="grid grid-cols-8 gap-1.5">
        {STUDENT_EMOJIS.map((e) => (
          <button key={e} onClick={() => setEmoji(e)}
            className={`h-10 rounded-xl text-xl border-2 transition-all active:scale-90 ${emoji===e?"bg-violet-50 border-violet-400":"bg-white border-gray-200 hover:border-violet-200"}`}>
            {e}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-bold text-red-500 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all"
          style={{ fontFamily:"Fredoka,sans-serif" }}>CANCELAR</button>
        <button onClick={submit}
          className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 active:scale-95 transition-all shadow-md"
          style={{ fontFamily:"Fredoka,sans-serif" }}>✓ CADASTRAR</button>
      </div>
    </div>
  );
}

function TeacherLogin({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch(`http://${window.location.hostname}:3001/api/teacher/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) throw new Error((await response.json()).message ?? "Não foi possível entrar.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background:"linear-gradient(145deg,#fdf4ff,#ede9fe,#e0e7ff)" }}>
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-xl border-2 border-violet-100">
        <button type="button" onClick={onBack} className="text-violet-500 text-sm font-bold mb-6">← VOLTAR</button>
        <div className="text-center mb-6"><div className="text-5xl mb-2">👩‍🏫</div><h1 className="text-3xl text-violet-800 font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>ÁREA DO PROFESSOR</h1><p className="text-gray-400 font-bold text-sm mt-1">ACESSO RESTRITO</p></div>
        <label className="block text-xs font-bold text-gray-500 mb-1">USUÁRIO</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none mb-4" placeholder="Digite seu usuário" />
        <label className="block text-xs font-bold text-gray-500 mb-1">SENHA</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-violet-400 outline-none" placeholder="Digite sua senha" />
        {error && <p className="text-red-500 text-sm font-bold mt-3">{error}</p>}
        <button disabled={loading || !username || !password} className="w-full mt-5 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>{loading ? "ENTRANDO..." : "ENTRAR NO PAINEL"}</button>
        <p className="text-xs text-gray-400 text-center mt-4">As credenciais podem ser alteradas pelas variáveis TEACHER_USERNAME e TEACHER_PASSWORD no servidor.</p>
      </form>
    </div>
  );
}
function TeacherDashboard({ students, notifications, onSelect, onBack, onLogout, onDeleteStudent, onDismissNotification, onDismissAllNotifications, onPromoteFromNotification, onAddStudent }: {
  students: Student[]; notifications: TeacherNotification[];
  onSelect: (s: Student) => void; onBack: () => void;
  onLogout: () => void; onDeleteStudent: (studentId: number) => void;
  onDismissNotification: (id: number) => void; onDismissAllNotifications: () => void;
  onPromoteFromNotification: (studentId: number, area: Area, notifId: number) => void;
  onAddStudent: (name: string, emoji: string) => void;
}) {
  const [filter, setFilter] = useState<"all"|"literacy"|"math">("all");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const avgAccuracy = students.length ? Math.round(students.reduce((a,s)=>a+s.accuracy,0)/students.length) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="text-white p-6 shadow-xl" style={{ background:"linear-gradient(135deg,#4c1d95,#6d28d9)" }}>
        <div className="flex items-center justify-between mb-1">
          <button onClick={onBack} className="text-white/60 text-sm font-bold hover:text-white" style={{ fontFamily:"Fredoka,sans-serif" }}>← VOLTAR</button>
          <div className="flex items-center gap-2">
            <button onClick={onLogout} className="px-3 py-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>SAIR</button>
            <button onClick={() => { setShowAddStudent(v=>!v); setShowNotifications(false); }}
              className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-sm font-bold transition-all"
              style={{ fontFamily:"Fredoka,sans-serif" }}>
              <span className="text-base">➕</span> NOVO ALUNO
            </button>
            <button onClick={() => { setShowNotifications(v=>!v); setShowAddStudent(false); }} className="relative p-2 rounded-2xl bg-white/20 hover:bg-white/30 transition-all">
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center animate-pulse-glow">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">👩‍🏫</div>
          <h1 className="text-2xl font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>PAINEL DO PROFESSOR</h1>
        </div>
        <p className="text-white/50 text-sm font-bold">{students.length} ALUNOS · {unreadCount} NOTIFICAÇÕES</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[{label:"MÉDIA",value:`${avgAccuracy}%`,icon:"📊"},{label:"ATIVIDADES",value:students.reduce((a,s)=>a+s.attempts,0).toString(),icon:"🎯"},{label:"SONDAGENS",value:students.reduce((a,s)=>a+s.sondagemHistory.length,0).toString(),icon:"🔍"}].map((c) => (
            <div key={c.label} className="bg-white/15 rounded-2xl p-3 text-center border border-white/10">
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-xl font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>{c.value}</div>
              <div className="text-xs text-white/50 font-bold">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      {showAddStudent && (
        <AddStudentForm
          existingNames={students.map(s => s.name.toUpperCase())}
          onAdd={(name, emoji) => { onAddStudent(name, emoji); setShowAddStudent(false); }}
          onCancel={() => setShowAddStudent(false)}
        />
      )}
      {showNotifications && (
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-800 text-base" style={{ fontFamily:"Fredoka,sans-serif" }}>🔔 NOTIFICAÇÕES</p>
            <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
          <NotificationsPanel
            notifications={notifications}
            onDismiss={onDismissNotification}
            onDismissAll={onDismissAllNotifications}
            onPromote={onPromoteFromNotification}
          />
        </div>
      )}
      <div className="flex gap-2 p-4">
        {(["all","literacy","math"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${filter===f?"bg-violet-600 text-white shadow-md":"bg-white text-gray-500 border border-gray-200"}`}
            style={{ fontFamily:"Fredoka,sans-serif" }}>
            {f==="all"?"TODOS":f==="literacy"?"📚 LEITURA":"🔢 MATEMÁTICA"}
          </button>
        ))}
      </div>
      <div className="px-4 pb-8 space-y-3">
        {students.map((s) => {
          const litM = LIT_META[s.literacyLevel];
          const mathM = MATH_META[s.mathLevel];
          const litReady = s.literacyMissionsDone >= MISSIONS_REQUIRED;
          const mathReady = s.mathMissionsDone >= MISSIONS_REQUIRED;
          return (
            <div key={s.id}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all text-left">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelect(s)}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border-2 border-gray-100" style={{ background:litM.pastelBg }}>{s.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800 text-lg" style={{ fontFamily:"Fredoka,sans-serif" }}>{s.name}</p>
                    {!s.audioEnabled && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">🔇 MUDO</span>}
                  </div>
                  {(filter==="all"||filter==="literacy") && (
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${litM.badge}`}>📚 {litM.name}</span>
                      {litReady && <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">✨ PRONTO</span>}
                    </div>
                  )}
                  {(filter==="all"||filter==="math") && (
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${mathM.badge}`}>🔢 {mathM.name}</span>
                      {mathReady && <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">✨ PRONTO</span>}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <Stars count={s.literacyStars} size="text-sm" />
                  <div className="text-xs text-gray-400 mt-1">{s.accuracy}%</div>
                </div>
                <span className="text-gray-300 text-lg">›</span>
              </div>
              <button onClick={() => onDeleteStudent(s.id)} className="w-full mt-3 py-2 rounded-xl border-2 border-red-100 text-red-500 text-xs font-bold hover:bg-red-50 transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>🗑️ EXCLUIR ALUNO</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function generateSondagemSuggestion(entry: SondagemEntry): { text: string; icon: string; color: string } {
  const pct = entry.total > 0 ? Math.round((entry.score / entry.total) * 100) : 0;
  const responses = entry.responses ?? [];
  const errors = responses.filter(r => !r.correct);
  const errorWords = errors.map(r => r.spoken.toUpperCase());

  // Detect common patterns in errors
  const hasAccentErrors = errors.some(r => {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return norm(r.written) === norm(r.spoken.toUpperCase()) && r.written !== r.spoken.toUpperCase();
  });
  const hasPhoneticSub = errors.some(r =>
    r.written.length > 0 && r.written !== "—" &&
    Math.abs(r.written.length - r.spoken.length) <= 1
  );
  const hasBlankAnswers = errors.some(r => r.written === "—" || r.written.length === 0);
  const hasInvertedLetters = errors.some(r => {
    const w = r.written; const s = r.spoken.toUpperCase();
    return w.length === s.length && w.split("").sort().join("") === s.split("").sort().join("");
  });

  if (pct >= 100) return { icon: "🌟", color: "emerald", text: "Excelente! A criança demonstrou domínio completo das palavras avaliadas. Recomenda-se avançar para o próximo nível de leitura e desafiar com palavras mais complexas." };
  if (pct >= 80) return { icon: "✅", color: "green", text: `Ótimo desempenho! Errou apenas ${entry.total - entry.score} palavra(s). Pratique as palavras: ${errorWords.join(", ")}. A criança está próxima de avançar de nível.` };
  if (hasBlankAnswers && pct < 50) return { icon: "🎵", color: "blue", text: "A criança não completou algumas palavras, o que pode indicar dificuldade de discriminação auditiva. Sugere-se atividades de consciência fonológica: rimas, sons iniciais e finais." };
  if (hasInvertedLetters) return { icon: "🔄", color: "orange", text: `A criança demonstra inversão de letras em palavras como ${errorWords.slice(0,2).join(", ")}. Recomenda-se atividades de sequência silábica e uso de materiais concretos (sílabas móveis).` };
  if (hasAccentErrors) return { icon: "✏️", color: "yellow", text: `A criança escreve foneticamente, mas ainda não domina acentuação. Bom sinal de desenvolvimento! Trabalhe com palavras: ${errorWords.join(", ")}.` };
  if (hasPhoneticSub && pct >= 50) return { icon: "🔤", color: "violet", text: `A criança apresenta escrita silábica-alfabética. Erros em: ${errorWords.join(", ")}. Atividades de leitura com segmentação silábica ajudarão na consolidação.` };
  if (pct >= 50) return { icon: "📖", color: "indigo", text: `Desempenho intermediário (${pct}%). Foco nas palavras: ${errorWords.join(", ")}. Recomenda-se revisão das sílabas complexas e leitura compartilhada diária.` };
  return { icon: "⚠️", color: "red", text: `A criança acertou apenas ${pct}% da sondagem. Recomenda-se reforço no nível ${entry.level} com atividades de reconhecimento de letras, sons e sílabas antes de nova avaliação.` };
}

function StudentProfile({ student, onBack, onPromote, onDemote, onToggleAudio }: {
  student: Student; onBack: () => void; onPromote: (area: Area) => void; onDemote: (area: Area) => void;
  onToggleAudio: () => void;
}) {
  const [tab, setTab] = useState<"literacy"|"math"|"sondagem">("literacy");
  const litM = LIT_META[student.literacyLevel];
  const mathM = MATH_META[student.mathLevel];
  const litReady = student.literacyMissionsDone >= MISSIONS_REQUIRED;
  const mathReady = student.mathMissionsDone >= MISSIONS_REQUIRED;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className={`bg-gradient-to-br ${tab==="math"?mathM.bg:litM.bg} text-white p-6 shadow-lg`}>
        <button onClick={onBack} className="text-white/70 text-sm font-bold hover:text-white mb-4 block" style={{ fontFamily:"Fredoka,sans-serif" }}>← TURMA</button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-4xl border-4 border-white/30">{student.emoji}</div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>{student.name}</h2>
            <p className="text-white/70 text-sm font-bold">{student.attempts} ATIVIDADES · {student.accuracy}% ACERTOS</p>
          </div>
          {/* Audio toggle por aluno */}
          <button onClick={onToggleAudio}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl border-2 transition-all ${student.audioEnabled?"bg-white/20 border-white/40 text-white":"bg-red-900/30 border-red-300/40 text-red-200"}`}
            style={{ fontFamily:"Fredoka,sans-serif" }}>
            <span className="text-2xl">{student.audioEnabled ? "🔊" : "🔇"}</span>
            <span className="text-xs font-bold">{student.audioEnabled ? "ÁUDIO ON" : "ÁUDIO OFF"}</span>
          </button>
        </div>
      </div>
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {(["literacy","math","sondagem"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-bold transition-all ${tab===t?"text-violet-700 border-b-2 border-violet-600":"text-gray-400 hover:text-gray-600"}`}
            style={{ fontFamily:"Fredoka,sans-serif" }}>
            {t==="literacy"?"📚 LEITURA":t==="math"?"🔢 MATEMÁTICA":"🔍 SONDAGENS"}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-4">
        {tab === "literacy" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-800 text-base" style={{ fontFamily:"Fredoka,sans-serif" }}>NÍVEL: {litM.name}</p>
                <p className="text-sm text-gray-400 font-bold">{student.literacyMissionsDone}/{MISSIONS_REQUIRED} MISSÕES</p>
              </div>
              <span className={`text-2xl px-2 py-1 rounded-2xl font-bold ${litM.badge}`}>{student.literacyLevel}/{LITERACY_MAX_LEVEL}</span>
            </div>
            {litReady && student.literacyLevel < LITERACY_MAX_LEVEL && (
              <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-3 mb-3">
                <p className="text-xs font-bold text-violet-700 mb-2">✨ ALUNO PRONTO PARA AVANÇAR!</p>
                <button onClick={() => onPromote("literacy")} className="w-full py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 active:scale-95 transition-all shadow-md" style={{ fontFamily:"Fredoka,sans-serif" }}>
                  🚀 AVANÇAR PARA {LIT_META[Math.min(student.literacyLevel+1,LITERACY_MAX_LEVEL)].name}
                </button>
              </div>
            )}
            {student.literacyLevel >= LITERACY_MAX_LEVEL && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <p className="text-xs font-bold text-amber-700">🏆 NÍVEL MÁXIMO ATINGIDO!</p>
              </div>
            )}
            {!litReady && student.literacyLevel < LITERACY_MAX_LEVEL && (
              <button onClick={() => onPromote("literacy")} className="w-full mb-3 py-2 rounded-xl border-2 border-gray-200 text-gray-400 font-bold text-xs hover:border-violet-300 hover:text-violet-500 transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>
                AVANÇAR NÍVEL MANUALMENTE ↑
              </button>
            )}
            {student.literacyLevel > 1 && (
              <button onClick={() => onDemote("literacy")} className="w-full mb-3 py-2 rounded-xl border-2 border-orange-100 text-orange-400 font-bold text-xs hover:border-orange-300 hover:bg-orange-50 active:scale-95 transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>
                ⬇️ REGREDIR PARA {LIT_META[Math.max(student.literacyLevel-1,1)].name}
              </button>
            )}
            <SkillBar label="LETRAS" value={student.skills.letras} />
            <SkillBar label="SÍLABAS" value={student.skills.silabas} />
            <SkillBar label="SONS" value={student.skills.sons} />
            <SkillBar label="PALAVRAS" value={student.skills.palavras} />
            <SkillBar label="ESCRITA" value={student.skills.escrita} />
          </div>
        )}
        {tab === "math" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-800 text-base" style={{ fontFamily:"Fredoka,sans-serif" }}>NÍVEL: {mathM.name}</p>
                <p className="text-sm text-gray-400 font-bold">{student.mathMissionsDone}/{MISSIONS_REQUIRED} MISSÕES</p>
              </div>
              <span className={`text-2xl px-2 py-1 rounded-2xl font-bold ${mathM.badge}`}>{student.mathLevel}/{MATH_MAX_LEVEL}</span>
            </div>
            {mathReady && student.mathLevel < MATH_MAX_LEVEL && (
              <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-3 mb-3">
                <p className="text-xs font-bold text-teal-700 mb-2">✨ ALUNO PRONTO PARA AVANÇAR!</p>
                <button onClick={() => onPromote("math")} className="w-full py-2.5 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 active:scale-95 transition-all shadow-md" style={{ fontFamily:"Fredoka,sans-serif" }}>
                  🚀 AVANÇAR PARA {MATH_META[Math.min(student.mathLevel+1,MATH_MAX_LEVEL)].name}
                </button>
              </div>
            )}
            {student.mathLevel >= MATH_MAX_LEVEL && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <p className="text-xs font-bold text-amber-700">🏆 NÍVEL MÁXIMO ATINGIDO!</p>
              </div>
            )}
            {!mathReady && student.mathLevel < MATH_MAX_LEVEL && (
              <button onClick={() => onPromote("math")} className="w-full mb-3 py-2 rounded-xl border-2 border-gray-200 text-gray-400 font-bold text-xs hover:border-teal-300 hover:text-teal-500 transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>
                AVANÇAR NÍVEL MANUALMENTE ↑
              </button>
            )}
            {student.mathLevel > 1 && (
              <button onClick={() => onDemote("math")} className="w-full mb-3 py-2 rounded-xl border-2 border-orange-100 text-orange-400 font-bold text-xs hover:border-orange-300 hover:bg-orange-50 active:scale-95 transition-all" style={{ fontFamily:"Fredoka,sans-serif" }}>
                ⬇️ REGREDIR PARA {MATH_META[Math.max(student.mathLevel-1,1)].name}
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[{label:"NÍVEL",value:`${student.mathLevel}/${MATH_MAX_LEVEL}`},{label:"ESTRELAS",value:`${student.mathStars}/5 ★`},{label:"MISSÕES",value:student.mathMissionsDone.toString()},{label:"PRECISÃO",value:`${student.accuracy}%`}].map((item)=>(
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-violet-700" style={{ fontFamily:"Fredoka,sans-serif" }}>{item.value}</p>
                  <p className="text-xs text-gray-400 font-bold">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "sondagem" && (
          <div className="space-y-4">
            {student.sondagemHistory.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-gray-400 font-bold" style={{ fontFamily:"Fredoka,sans-serif" }}>NENHUMA SONDAGEM REALIZADA AINDA.</p>
              </div>
            ) : student.sondagemHistory.slice().reverse().map((entry, i) => {
              const pct = entry.total > 0 ? Math.round((entry.score / entry.total) * 100) : 0;
              const sugg = generateSondagemSuggestion(entry);
              const colorMap: Record<string, string> = {
                emerald:"bg-emerald-50 border-emerald-200 text-emerald-700",
                green:"bg-green-50 border-green-200 text-green-700",
                blue:"bg-blue-50 border-blue-200 text-blue-700",
                orange:"bg-orange-50 border-orange-200 text-orange-700",
                yellow:"bg-yellow-50 border-yellow-200 text-yellow-700",
                violet:"bg-violet-50 border-violet-200 text-violet-700",
                indigo:"bg-indigo-50 border-indigo-200 text-indigo-700",
                red:"bg-red-50 border-red-200 text-red-700",
              };
              const suggClass = colorMap[sugg.color] ?? colorMap.violet;
              return (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 pb-2">
                    <div>
                      <p className="font-bold text-gray-800 text-sm" style={{ fontFamily:"Fredoka,sans-serif" }}>
                        {entry.area==="literacy"?"📚 LEITURA":"🔢 MATEMÁTICA"} — NÍVEL {entry.level}
                      </p>
                      <p className="text-xs text-gray-400 font-bold mt-0.5">{entry.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xl text-violet-700" style={{ fontFamily:"Fredoka,sans-serif" }}>{entry.score}/{entry.total}</p>
                      <p className="text-xs text-gray-400 font-bold">{pct}% de acerto</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mx-4 mb-3 h-2 bg-gray-100 rounded-full">
                    <div className="h-2 rounded-full transition-all" style={{ width:`${pct}%`, background: pct >= 80 ? "#34d399" : pct >= 50 ? "#818cf8" : "#f87171" }} />
                  </div>

                  {/* Word-by-word breakdown */}
                  {(entry.responses ?? []).length > 0 && (
                    <div className="px-4 pb-3">
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Detalhamento por palavra</p>
                      <div className="space-y-1.5">
                        {entry.responses.map((r, j) => (
                          <div key={j} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.correct ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                            <span className="text-base">{r.correct ? "✅" : "❌"}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-gray-500 uppercase">Ouviu:</span>
                                <span className="text-sm font-bold text-gray-700 uppercase" style={{ fontFamily:"Fredoka,sans-serif" }}>{r.spoken}</span>
                                <span className="text-gray-300">→</span>
                                <span className="text-xs font-bold text-gray-500 uppercase">Escreveu:</span>
                                <span className={`text-sm font-bold uppercase ${r.correct ? "text-emerald-600" : "text-red-500"}`} style={{ fontFamily:"Fredoka,sans-serif" }}>
                                  {r.written || "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pedagogical suggestion */}
                  <div className={`mx-4 mb-4 rounded-xl p-3 border ${suggClass}`}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1 opacity-70">💡 Sugestão pedagógica</p>
                    <p className="text-sm font-semibold leading-relaxed">{sugg.icon} {sugg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// APP ROOT
// ════════════════════════════════════════════════════════════════

export default function App() {
  const [view, setView] = useState<AppView>("avatar");
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const isLoadingFromServer = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area>("literacy");
  const [sondagemResults, setSondagemResults] = useState<boolean[]>([]);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMissionsDone, setFeedbackMissionsDone] = useState(0);
  const [activityQueue, setActivityQueue] = useState<number[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  
  const updateStudentOnServer = async (student: Student) => {
  try {
    const response = await fetch(
      `http://${window.location.hostname}:3001/api/students/${student.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(student),
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao atualizar aluno");
    }

    console.log(`Aluno ${student.name} atualizado no servidor.`);
  } catch (error) {
    console.error("Erro ao atualizar aluno:", error);
  }
};

  useEffect(() => {
  const loadStudents = async () => {
    try {
      const response = await fetch(
        `http://${window.location.hostname}:3001/api/students`
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar alunos");
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        isLoadingFromServer.current = true;
        setStudents(data);
      } else {
        await fetch(
          `http://${window.location.hostname}:3001/api/students`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(initialStudents),
          }
        );
      }
    } catch (error) {
      console.error("Erro ao conectar com o servidor:", error);
    }
  };

  loadStudents();
}, []);

useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `http://${window.location.hostname}:3001/api/students`
      );

      if (!response.ok) return;

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const currentData = JSON.stringify(students);
        const serverData = JSON.stringify(data);

        if (currentData !== serverData) {
          isLoadingFromServer.current = true;
          setStudents(data);
        }
      }
    } catch (error) {
      console.error("Servidor indisponível:", error);
    }
  }, 1000);

  return () => clearInterval(interval);
}, [students]);

  const currentStudent = selectedId != null ? (students.find((s) => s.id === selectedId) ?? null) : null;
  const currentIdx = activityQueue[queuePos % Math.max(activityQueue.length, 1)] ?? 0;

  const startGame = (area: Area, student: Student) => {
    const pool = getActivities(area, getLevelForArea(student, area));
    setActivityQueue(shuffle(Array.from({ length: pool.length }, (_, i) => i)));
    setQueuePos(0); setGameKey((k) => k + 1); setView("game");
  };

  const handleAvatarSelect = (s: Student) => { setSelectedId(s.id); setView("area-select"); };
  const handleAreaSelect = (area: Area) => { setSelectedArea(area); startGame(area, currentStudent!); };
  const handleSondagemHubSelect = (area: Area) => { setSelectedArea(area); setView("sondagem"); };

  const handleSondagemComplete = (results: boolean[], responses: SondagemResponse[]) => {
    if (!currentStudent) return;
    setSondagemResults(results);
    const entry: SondagemEntry = { date: today(), area: selectedArea, level: getLevelForArea(currentStudent, selectedArea), score: results.filter(Boolean).length, total: results.length, responses };
    setStudents((prev) => prev.map((s) => s.id !== currentStudent.id ? s : {
      ...s,
      lastLiteracySondagem: selectedArea === "literacy" ? today() : s.lastLiteracySondagem,
      lastMathSondagem: selectedArea === "math" ? today() : s.lastMathSondagem,
      sondagemHistory: [...s.sondagemHistory, entry],
    }));
    setView("sondagem-result");
  };

  const handlePromoteStudent = (studentId: number, area: Area) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const currentLevel = area === "literacy" ? student.literacyLevel : student.mathLevel;
    const newLevel = area === "literacy" ? Math.min(currentLevel + 1, LITERACY_MAX_LEVEL) : Math.min(currentLevel + 1, MATH_MAX_LEVEL);
    setStudents((prev) => prev.map((s) => {
      if (s.id !== studentId) return s;
      if (area === "literacy") return { ...s, literacyLevel: newLevel, literacyMissionsDone: 0, literacyStars: Math.min(s.literacyStars + 1, 5) };
      return { ...s, mathLevel: newLevel, mathMissionsDone: 0, mathStars: Math.min(s.mathStars + 1, 5) };
    }));
    setNotifications(prev => [
      { id: Date.now(), studentId, studentName: student.name, studentEmoji: student.emoji, area, level: newLevel, levelName: getLevelName(area, newLevel), date: today(), read: false, direction: "up" as const },
      ...prev.filter(n => !(n.studentId === studentId && n.area === area && n.direction === "complete")),
    ]);
  };

  const handleDemoteStudent = (studentId: number, area: Area) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const currentLevel = area === "literacy" ? student.literacyLevel : student.mathLevel;
    if (currentLevel <= 1) return;
    const newLevel = currentLevel - 1;
    setStudents((prev) => prev.map((s) => {
      if (s.id !== studentId) return s;
      if (area === "literacy") return { ...s, literacyLevel: newLevel, literacyMissionsDone: 0, literacyStars: Math.max(s.literacyStars - 1, 0) };
      return { ...s, mathLevel: newLevel, mathMissionsDone: 0, mathStars: Math.max(s.mathStars - 1, 0) };
    }));
    setNotifications(prev => [
      { id: Date.now(), studentId, studentName: student.name, studentEmoji: student.emoji, area, level: newLevel, levelName: getLevelName(area, newLevel), date: today(), read: false, direction: "down" as const },
      ...prev.filter(n => !(n.studentId === studentId && n.area === area)),
    ]);
  };

  const handlePromoteFromNotification = (studentId: number, area: Area, notifId: number) => {
    handlePromoteStudent(studentId, area);
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const handleAddStudent = async (name: string, emoji: string) => {
  const newStudent = {
    name,
    emoji,
    literacyLevel: 1,
    literacyStars: 0,
    literacyMissionsDone: 0,
    lastLiteracySondagem: null,

    mathLevel: 1,
    mathStars: 0,
    mathMissionsDone: 0,
    lastMathSondagem: null,

    sondagemHistory: [],

    skills: {
      letras: 0,
      silabas: 0,
      sons: 0,
      palavras: 0,
      escrita: 0,
    },

    attempts: 0,
    accuracy: 0,
    audioEnabled: true,
  };

  try {
    const response = await fetch(
      `http://${window.location.hostname}:3001/api/students`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newStudent),
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao cadastrar aluno");
    }

    const data = await response.json();

    setStudents((prev) => [...prev, data.student]);

    console.log("Aluno cadastrado:", data.student);
  } catch (error) {
    console.error("Erro ao cadastrar aluno:", error);
  }
};

  const handleToggleAudio = (studentId: number) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, audioEnabled: !s.audioEnabled } : s));
  };

  const handleGameResult = (correct: boolean, _usedHint: boolean) => {
    if (!currentStudent) return;
    setFeedbackCorrect(correct);
    if (correct) {
      const isLit = selectedArea === "literacy";
      const curDone = isLit ? currentStudent.literacyMissionsDone : currentStudent.mathMissionsDone;
      const newDone = Math.min(curDone + 1, MISSIONS_REQUIRED);
      setFeedbackMissionsDone(newDone);
      const justCompleted = newDone >= MISSIONS_REQUIRED && curDone < MISSIONS_REQUIRED;
      setStudents((prev) => prev.map((s) => s.id !== currentStudent.id ? s : {
        ...s,
        literacyMissionsDone: isLit ? newDone : s.literacyMissionsDone,
        literacyStars: isLit && newDone >= MISSIONS_REQUIRED && s.literacyStars < 5 ? Math.min(s.literacyStars+1,5) : s.literacyStars,
        mathMissionsDone: !isLit ? newDone : s.mathMissionsDone,
        mathStars: !isLit && newDone >= MISSIONS_REQUIRED && s.mathStars < 5 ? Math.min(s.mathStars+1,5) : s.mathStars,
        attempts: s.attempts + 1,
        accuracy: Math.min(100, Math.round((s.accuracy * s.attempts + 100) / (s.attempts + 1))),
      }));
      if (justCompleted) {
        const level = getLevelForArea(currentStudent, selectedArea);
        setNotifications(prev => [{ id: Date.now(), studentId: currentStudent.id, studentName: currentStudent.name, studentEmoji: currentStudent.emoji, area: selectedArea, level, levelName: getLevelName(selectedArea, level), date: today(), read: false, direction: "complete" as const }, ...prev]);
      }
      setQueuePos((p) => p + 1);
    } else {
      setFeedbackMissionsDone(selectedArea === "literacy" ? currentStudent.literacyMissionsDone : currentStudent.mathMissionsDone);
      setStudents((prev) => prev.map((s) => s.id !== currentStudent.id ? s : { ...s, attempts: s.attempts + 1, accuracy: Math.max(0, Math.round((s.accuracy * s.attempts) / (s.attempts + 1))) }));
    }
    setView("feedback");
  };

  const handleSkipToNext = () => {
    if (!currentStudent) return;
    setStudents((prev) => prev.map((s) => s.id === currentStudent.id ? { ...s, attempts: s.attempts + 1 } : s));
    setQueuePos((p) => p + 1); setGameKey((k) => k + 1); setView("game");
  };

  return (
    <div className="size-full">
      {view === "avatar" && <AvatarScreen students={students} onSelect={handleAvatarSelect} onTeacher={() => { stopSpeech(); setView("teacher-login"); }} />}
      {view === "area-select" && currentStudent && (
        <AreaSelectScreen student={currentStudent} onSelect={handleAreaSelect}
          onSondagem={() => { stopSpeech(); setView("sondagem-hub"); }}
          onAlphabet={() => { stopSpeech(); setView("alphabet"); }}
          onBack={() => { stopSpeech(); setView("avatar"); }} />
      )}
      {view === "sondagem-hub" && currentStudent && <SondagemHubScreen student={currentStudent} onSelect={handleSondagemHubSelect} onBack={() => { stopSpeech(); setView("area-select"); }} />}
      {view === "sondagem" && currentStudent && <SondagemScreen student={currentStudent} area={selectedArea} onComplete={handleSondagemComplete} onSkip={() => { stopSpeech(); setView("sondagem-hub"); }} />}
      {view === "sondagem-result" && currentStudent && <SondagemResultScreen results={sondagemResults} area={selectedArea} level={getLevelForArea(currentStudent, selectedArea)} onContinue={() => { stopSpeech(); setView("sondagem-hub"); }} />}
      {view === "alphabet" && <AlphabetScreen onBack={() => { stopSpeech(); setView("area-select"); }} />}
      {view === "game" && currentStudent && (
        <GameScreen key={gameKey} student={currentStudent} area={selectedArea} activityIndex={currentIdx}
          onResult={handleGameResult} onSkipToNext={handleSkipToNext}
          onBack={() => { stopSpeech(); setView("area-select"); }} />
      )}
      {view === "feedback" && currentStudent && (
        <FeedbackScreen correct={feedbackCorrect} missionsDoneAfter={feedbackMissionsDone}
          area={selectedArea} onContinue={() => { setGameKey((k) => k + 1); setView("game"); }} />
      )}
      {view === "teacher-login" && <TeacherLogin onSuccess={() => setView("teacher")} onBack={() => setView("avatar")} />}
      {view === "teacher" && (
        <TeacherDashboard students={students} notifications={notifications}
          onSelect={(s) => { setSelectedId(s.id); setView("profile"); }}
          onBack={() => setView("avatar")}
          onLogout={handleTeacherLogout}
          onDeleteStudent={handleDeleteStudent}
          onDismissNotification={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
          onDismissAllNotifications={() => setNotifications([])}
          onPromoteFromNotification={handlePromoteFromNotification}
          onAddStudent={handleAddStudent} />
      )}
      {view === "profile" && currentStudent && (
        <StudentProfile student={currentStudent}
          onPromote={(area) => handlePromoteStudent(currentStudent.id, area)}
          onDemote={(area) => handleDemoteStudent(currentStudent.id, area)}
          onToggleAudio={() => handleToggleAudio(currentStudent.id)}
          onBack={() => setView("teacher")} />
      )}
    </div>
  );
}
