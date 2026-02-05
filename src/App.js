import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

function App() {
  const [contratos, setContratos] = useState([]);
  const [formData, setFormData] = useState({ orgao: '', servico: '', fonte: '' });
  const [operador, setOperador] = useState('');
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  
  // ESTADOS DO RELATÓRIO
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  const [filtroOperadorRelatorio, setFiltroOperadorRelatorio] = useState('TODOS');

  const orgaoInputRef = useRef(null);

  const frases = [
    "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
    "Trabalhar em equipe divide as tarefas e multiplica o sucesso!",
    "Meta dada é meta batida. Vamos com tudo!",
    "A excelência não é um ato, mas um hábito. Bom trabalho!",
    "Foco no processo, o resultado é consequência do seu esforço."
  ];
  const fraseDoDia = frases[new Date().getDay() % frases.length];

  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("created_at", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(dados); 
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let nomeFinal = formData.orgao.toUpperCase();
    if (nomeFinal && !nomeFinal.startsWith('PM ')) nomeFinal = `PM ${nomeFinal}`;

    try {
      await addDoc(collection(db, "contratos"), {
        orgao: nomeFinal,
        servico: formData.servico.toUpperCase(),
        fonte: formData.fonte.toUpperCase(),
        status: 'RECEBIDO',
        responsavel: '',
        created_at: serverTimestamp()
      });
      setFormData({ orgao: '', servico: '', fonte: '' });
      orgaoInputRef.current?.focus();
    } catch (error) { console.error(error); }
  };

  const alterarStatus = async (id, novoStatus) => {
    const data = { status: novoStatus };
    if (novoStatus === 'PRODUCAO') data.responsavel = operador.toUpperCase() || 'EQUIPE';
    if (novoStatus === 'CONCLUIDO') data.finished_at = new Date().toISOString();
    await updateDoc(doc(db, "contratos", id), data);
  };

  // EXPORTAR RELATÓRIO COM FILTRO DE OPERADOR
  const exportarRelatorio = () => {
    const tarefasFiltradas = contratos.filter(c => {
      const dataTarefa = c.finished_at?.split('T')[0];
      const bateData = c.status === 'CONCLUIDO' && dataTarefa === filtroData;
      const bateOperador = filtroOperadorRelatorio === 'TODOS' || c.responsavel === filtroOperadorRelatorio;
      return bateData && bateOperador;
    });

    if (tarefasFiltradas.length === 0) return alert("Nenhuma tarefa encontrada para este filtro.");

    let conteudo = `RELATÓRIO DE DEMANDAS - DATA: ${filtroData}\n`;
    conteudo += `OPERADOR: ${filtroOperadorRelatorio}\n`;
    conteudo += `-------------------------------------------\n\n`;

    tarefasFiltradas.forEach((t, i) => {
      conteudo += `${i+1}. [${t.responsavel}] ${t.orgao} | ${t.servico}\n`;
    });

    const blob = new Blob([conteudo], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${filtroOperadorRelatorio}_${filtroData}.txt`;
    link.click();
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');
  
  // Lista única de operadores que já concluíram algo (para o filtro do relatório)
  const listaOperadoresConcluidos = [...new Set(historico.map(h => h.responsavel))].filter(Boolean);

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-sm font-black text-blue-600 uppercase tracking-[0.3em]">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          <p className="text-slate-500 italic font-medium mt-1">"{fraseDoDia}"</p>
        </div>
      </div>

      <LayoutGroup>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl">
              <label className="text-[10px] font-black uppercase text-blue-400">Operador Atual</label>
              <input className="w-full bg-slate-800 border-none rounded-2xl p-4 mt-2 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="SEU NOME..." value={operador} onChange={(e) => setOperador(e.target.value)} />
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
              <h2 className="text-xl font-black mb-6 uppercase italic">Lançar Demanda</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold uppercase outline-none focus:border-blue-500" placeholder="CIDADE" onChange={e => setFormData({...formData, orgao: e.target.value})} value={formData.orgao} />
                <input list="s-serv" className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="SERVIÇO" onChange={e => setFormData({...formData, servico: e.target.value})} value={formData.servico} />
                <datalist id="s-serv">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC"].map(s => <option key={s} value={s} />)}
                </datalist>
                <input className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="FONTE" onChange={e => setFormData({...formData, fonte: e.target.value})} value={formData.fonte} />
                <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black shadow-lg uppercase text-xs tracking-widest hover:bg-blue-700 transition-all">Registrar</button>
              </form>
            </div>

            {/* RELATÓRIO COM FILTRO DE OPERADOR */}
            <div className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-100">
              <h3 className="text-xs font-black uppercase mb-4 text-slate-400 tracking-widest">Relatório de Fechamento</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 ml-1">DATA:</label>
                  <input type="date" className="w-full p-3 border rounded-xl text-sm font-bold bg-slate-50 outline-none" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 ml-1">FILTRAR OPERADOR:</label>
                  <select 
                    className="w-full p-3 border rounded-xl text-sm font-bold bg-slate-50 outline-none"
                    value={filtroOperadorRelatorio}
                    onChange={(e) => setFiltroOperadorRelatorio(e.target.value)}
                  >
                    <option value="TODOS">TODOS OS OPERADORES</option>
                    {listaOperadoresConcluidos.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
                <button onClick={exportarRelatorio} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold text-[10px] uppercase hover:bg-black transition-all shadow-lg">Download .TXT</button>
              </div>
            </div>
          </div>

          {/* FILA ATIVA */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-black uppercase text-slate-300 italic mb-4">Fila de Prioridade</h2>
            
            <AnimatePresence mode='popLayout'>
              {filaAtiva.map((c, index) => (
                <motion.div 
                  key={c.id} layout initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.5 }}
                  className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] shadow-lg border-l-[15px] bg-white 
                    ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">#{index + 1}</span>
                      <h3 className="font-black text-xl uppercase text-slate-800 tracking-tighter">{c.orgao}</h3>
                    </div>
                    <p className="font-black text-blue-600 uppercase text-xs mt-1 ml-11">{c.servico}</p>
                    <div className="flex gap-4 mt-3 ml-11">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">🕒 {c.created_at?.toDate().toLocaleTimeString()}</span>
                      {c.responsavel && <span className="text-[10px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded">👤 {c.responsavel}</span>}
                    </div>
                  </div>

                  <div className="mt-4 md:mt-0 flex gap-2">
                    {c.
