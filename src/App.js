import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

// Bibliotecas de Exportação
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function App() {
  const [contratos, setContratos] = useState([]);
  const [operadoresDB, setOperadoresDB] = useState([]);
  const [operadorAtual, setOperadorAtual] = useState(null);
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
    if (filtrados.length === 0) return alert("Nada para exportar.");
    const dados = filtrados.map((t, i) => ({
      ID: i + 1, Cidade: t.orgao, Serviço: t.servico, Operador: t.responsavel, Data: filtroData
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção");
    XLSX.writeFile(wb, `Relatorio_${filtroData}.xlsx`);
  };

  const exportarPDF = () => {
    const filtrados = obterDadosFiltrados();
    if (filtrados.length === 0) return alert("Nada para exportar.");
    const doc = new jsPDF();
    const corpo = filtrados.map((t, i) => [i + 1, t.orgao, t.servico, t.responsavel]);
    doc.text(`Relatório de Produtividade - ${filtroData}`, 14, 15);
    doc.autoTable({ head: [['#', 'Cidade', 'Serviço', 'Operador']], body: corpo, startY: 20 });
    doc.save(`Relatorio_${filtroData}.pdf`);
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto mb-8 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-xs font-black text-blue-600 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          <p className="text-slate-400 italic text-[11px] mt-1">"{fraseDoDia}"</p>
        </div>
        <div className="bg-green-50 text-green-600 px-4 py-1 rounded-full text-[10px] font-black uppercase mt-4 md:mt-0">Sistema Ativo</div>
      </div>

      <LayoutGroup>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl text-white">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Operador Logado</label>
              <div className="flex gap-2 mt-3">
                <select 
                  className="flex-1 p-4 rounded-2xl bg-slate-800 font-bold outline-none ring-2 ring-blue-500/20 focus:ring-blue-500 text-sm"
                  onChange={(e) => setOperadorAtual(operadoresDB.find(o => o.id === e.target.value))}
                  value={operadorAtual?.id || ''}
                >
                  <option value="">SELECIONE SEU NOME...</option>
                  {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
                </select>
                <button onClick={cadastrarNovoOperador} className="bg-slate-800 hover:bg-slate-700 px-4 rounded-2xl font-black text-blue-400 border border-slate-700">+</button>
              </div>
            </div>

            <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 transition-all ${!operadorAtual ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
              <h2 className="text-xl font-black mb-6 uppercase italic">Lançar Demanda</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} required className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold uppercase outline-none" placeholder="CIDADE" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                <input list="s-serv" required className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none" placeholder="SERVIÇO" value={formData.servico} onChange={e => setFormData({...formData, servico: e.target.value})} />
                <datalist id="s-serv">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC"].map(s => <option key={s} value={s} />)}
                </datalist>
                <input className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none" placeholder="FONTE (Opcional)" value={formData.fonte} onChange={e => setFormData({...formData, fonte: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest hover:bg-blue-700 active:scale-95 transition-all">Registrar na Fila</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100">
              <h3 className="text-[10px] font-black uppercase mb-4 text-slate-400 text-center tracking-[0.2em]">Exportar Fechamento</h3>
              <div className="space-y-3">
                <input type="date" className="w-full p-3 border rounded-xl text-sm font-bold bg-slate-50 outline-none" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
                <select className="w-full p-3 border rounded-xl text-sm font-bold bg-slate-50 outline-none" value={filtroOperadorRelatorio} onChange={e => setFiltroOperadorRelatorio(e.target.value)}>
                  <option value="TODOS">TODOS</option>
                  {[...new Set(historico.map(h => h.responsavel))].map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportarExcel} className="bg-green-600 text-white p-3 rounded-xl font-black text-[10px] uppercase">Excel</button>
                  <button onClick={exportarPDF} className="bg-red-500 text-white p-3 rounded-xl font-black text-[10px] uppercase">PDF</button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-black uppercase text-slate-300 italic px-4">Fila de Atendimento</h2>
            <AnimatePresence mode='popLayout'>
              {filaAtiva.map((c, index) => (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                  className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] shadow-lg border-l-[15px] bg-white ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
                >
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px]">#{index + 1}</span>
                      <h3 className="font-black text-xl uppercase tracking-tighter">{c.orgao}</h3>
                    </div>
                    <p className="font-black text-blue-600 uppercase text-xs mt-1 ml-11">{c.servico}</p>
                    {c.responsavel && <div className="ml-11 mt-3"><span className="text-[9px] font-black px-3 py-1 rounded-full bg-orange-100 text-orange-600 uppercase italic">Em produção: {c.responsavel}</span></div>}
                  </div>
                  <div className="mt-4 md:mt-0 flex gap-2">
                    {c.status === 'RECEBIDO' ? (
                      <button onClick={() => alterarStatus(c.id, 'PRODUCAO')} className="bg-orange-500 text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase">Iniciar</button>
                    ) : (
                      <button onClick={() => alterarStatus(c.id, 'CONCLUIDO')} className="bg-green-500 text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase">Finalizar</button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="mt-12 bg-slate-200/30 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="w-full text-center font-black uppercase text-[10px] text-slate-400">
                 {mostrarHistorico ? '▲ Ocultar Concluídos' : '▼ Ver Histórico'}
               </button>
               {mostrarHistorico && (
                 <div className="mt-8 space-y-4">
                   {historico.slice().reverse().map(item => (
                     <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center">
                       <div><p className="font-black text-slate-700 uppercase text-[11px]">{item.orgao}</p></div>
                       <span className="text-[10px] font-black text-green-600">CONCLUÍDO</span>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}

export default App;
