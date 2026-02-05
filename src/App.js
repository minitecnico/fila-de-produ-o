import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

// Bibliotecas de Exportação (instale no package.json primeiro)
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function App() {
  // Estados de Dados
  const [contratos, setContratos] = useState([]);
  const [operadoresDB, setOperadoresDB] = useState([]);
  
  // Estados de Interface
  const [operadorAtual, setOperadorAtual] = useState(null);
  const [novoOperadorNome, setNovoOperadorNome] = useState('');
  const [formData, setFormData] = useState({ orgao: '', servico: '', fonte: '' });
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  const [filtroOperadorRelatorio, setFiltroOperadorRelatorio] = useState('TODOS');

  const orgaoInputRef = useRef(null);

  const frases = [
    "Trabalhar em equipe divide as tarefas e multiplica o sucesso!",
    "O foco no processo traz a excelência no resultado.",
    "Meta dada é meta batida. Vamos com tudo, time!",
    "Cada demanda concluída é um passo rumo à nossa meta diária!",
    "A união da nossa equipe é o que nos torna imbatíveis."
  ];
  const fraseDoDia = frases[new Date().getDay() % frases.length];

  useEffect(() => {
    const qContratos = query(collection(db, "contratos"), orderBy("created_at", "asc"));
    const unsubContratos = onSnapshot(qContratos, (snap) => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qOps = query(collection(db, "operadores"), orderBy("nome", "asc"));
    const unsubOps = onSnapshot(qOps, (snap) => {
      setOperadoresDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubContratos(); unsubOps(); };
  }, []);

  const cadastrarNovoOperador = async () => {
    const nome = prompt("Digite o nome do novo operador:");
    if (nome && nome.trim()) {
      await addDoc(collection(db, "operadores"), { nome: nome.toUpperCase().trim() });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operadorAtual) return alert("Selecione seu nome no topo!");
    
    let nomeCidade = formData.orgao.toUpperCase();
    if (nomeCidade && !nomeCidade.startsWith('PM ')) nomeCidade = `PM ${nomeCidade}`;

    await addDoc(collection(db, "contratos"), {
      orgao: nomeCidade,
      servico: formData.servico.toUpperCase(),
      fonte: formData.fonte.toUpperCase(),
      status: 'RECEBIDO',
      responsavel: '',
      created_at: serverTimestamp()
    });
    setFormData({ orgao: '', servico: '', fonte: '' });
    orgaoInputRef.current?.focus();
  };

  const alterarStatus = async (id, novoStatus) => {
    const data = { status: novoStatus };
    if (novoStatus === 'PRODUCAO') data.responsavel = operadorAtual.nome;
    if (novoStatus === 'CONCLUIDO') data.finished_at = new Date().toISOString();
    await updateDoc(doc(db, "contratos", id), data);
  };

  // --- LOGICA DE EXPORTAÇÃO ---
  const obterDadosFiltrados = () => {
    return contratos.filter(c => {
      const dataF = c.finished_at?.split('T')[0];
      const matchData = c.status === 'CONCLUIDO' && dataF === filtroData;
      const matchOp = filtroOperadorRelatorio === 'TODOS' || c.responsavel === filtroOperadorRelatorio;
      return matchData && matchOp;
    });
  };

  const exportarExcel = () => {
    const filtrados = obterDadosFiltrados();
    if (filtrados.length === 0) return alert("Nada para exportar nesta data.");
    
    const dados = filtrados.map((t, i) => ({
      ID: i + 1,
      Cidade: t.orgao,
      Serviço: t.servico,
      Operador: t.responsavel,
      Data: filtroData
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção");
    XLSX.writeFile(wb, `Relatorio_${filtroData}.xlsx`);
  };

  const exportarPDF = () => {
    const filtrados = obterDadosFiltrados();
    if (filtrados.length === 0) return alert("Nada para exportar nesta data.");

    const doc = new jsPDF();
    const corpoTabela = filtrados.map((t, i) => [i + 1, t.orgao, t.servico, t.responsavel]);
    
    doc.text(`Relatório de Produtividade - ${filtroData}`, 14, 15);
    doc.autoTable({
      head: [['#', 'Cidade/Orgão', 'Serviço', 'Operador']],
      body: corpoTabela,
      startY: 20,
      theme: 'grid'
    });
    doc.save(`Relatorio_${filtroData}.pdf`);
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-xs font-black text-blue-600 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          <p className="text-slate-400 italic text-[11px] mt-1">"{fraseDoDia}"</p>
        </div>
        <div className="bg-green-50 text-green-600 px-4 py-1 rounded-full text-[10px] font-black uppercase mt-4 md:mt-0 animate-pulse">Sistema Ativo</div>
      </div>

      <LayoutGroup>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="space-y-6">
            {/* SELETOR DE OPERADOR INTELIGENTE */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl text-white">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Operador Logado</label>
              <div className="flex gap-2 mt-3">
                <select 
                  className="flex-1 p-4 rounded-2xl bg-slate-800 font-bold outline-none ring-2 ring-blue-500/20 focus:ring-blue-500 transition-all cursor-pointer text-sm"
                  onChange={(e) => setOperadorAtual(operadoresDB.find(o => o.id === e.target.value))}
                  value={operadorAtual?.id || ''}
                >
                  <option value="">SELECIONE SEU NOME...</option>
                  {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
                </select>
                <button onClick={cadastrarNovoOperador} title="Novo Operador" className="bg-slate-800 hover:bg-slate-700 px-4 rounded-2xl font-black text-blue-400 border border-slate-700">+</button>
              </div>
            </div>

            {/* LANÇAMENTO */}
            <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 transition-all ${!operadorAtual ? 'opacity-30 grayscale cursor-not-allowed' : 'opacity-100'}`}>
              <h2 className="text-xl font-black mb-6 uppercase italic">Lançar Demanda</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} required className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold uppercase focus:border-blue-500 outline-none" placeholder="CIDADE" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                <input list="s-serv" required className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-
