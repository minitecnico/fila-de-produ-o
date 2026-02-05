import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

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

  // Frases Motivacionais (Data do Sistema)
  const frases = [
    "Trabalhar em equipe divide as tarefas e multiplica o sucesso!",
    "O foco no processo traz a excelência no resultado.",
    "Meta dada é meta batida. Vamos com tudo, time!",
    "Cada demanda concluída é um passo rumo à nossa meta diária!",
    "A união da nossa equipe é o que nos torna imbatíveis."
  ];
  const fraseDoDia = frases[new Date().getDay() % frases.length];

  // 1. Monitoramento em Tempo Real (Firestore)
  useEffect(() => {
    // Escutar Demandas (Fila)
    const qContratos = query(collection(db, "contratos"), orderBy("created_at", "asc"));
    const unsubContratos = onSnapshot(qContratos, (snap) => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Escutar Operadores Cadastrados
    const qOps = query(collection(db, "operadores"), orderBy("nome", "asc"));
    const unsubOps = onSnapshot(qOps, (snap) => {
      setOperadoresDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubContratos(); unsubOps(); };
  }, []);

  // 2. Funções de Ação
  const cadastrarNovoOperador = async () => {
    if (!novoOperadorNome.trim()) return;
    await addDoc(collection(db, "operadores"), { nome: novoOperadorNome.toUpperCase().trim() });
    setNovoOperadorNome('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operadorAtual) return alert("Selecione seu nome no topo antes de lançar!");
    
    let nomeCidade = formData.orgao.toUpperCase();
    if (nomeCidade && !nomeCidade.startsWith('PM ')) nomeCidade = `PM ${nomeCidade}`;

    await addDoc(collection(db, "contratos"), {
      orgao: nomeCidade,
      servico: formData.servico.toUpperCase(),
      fonte: formData.fonte.toUpperCase(),
      status: 'RECEBIDO', // Cor Vermelha
      responsavel: '',
      created_at: serverTimestamp()
    });
    setFormData({ orgao: '', servico: '', fonte: '' });
    orgaoInputRef.current?.focus();
  };

  const alterarStatus = async (id, novoStatus) => {
    const data = { status: novoStatus };
    if (novoStatus === 'PRODUCAO') data.responsavel = operadorAtual.nome; // Cor Laranja
    if (novoStatus === 'CONCLUIDO') data.finished_at = new Date().toISOString(); // Cor Verde
    await updateDoc(doc(db, "contratos", id), data);
  };

  const exportarRelatorio = () => {
    const filtrados = contratos.filter(c => {
      const dataF = c.finished_at?.split('T')[0];
      return c.status === 'CONCLUIDO' && dataF === filtroData && (filtroOperadorRelatorio === 'TODOS' || c.responsavel === filtroOperadorRelatorio);
    });
    if (filtrados.length === 0) return alert("Nenhuma demanda concluída para este filtro.");

    let txt = `RELATÓRIO DE PRODUTIVIDADE - ${filtroData}\n\n`;
    filtrados.forEach((t, i) => txt += `${i+1}. [${t.responsavel}] ${t.orgao} - ${t.servico}\n`);
    const blob = new Blob([txt], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${filtroData}.txt`;
    link.click();
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER MOTIVACIONAL */}
      <div className="max-w-6xl mx-auto mb-8 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-xs font-black text-blue-600 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          <p className="text-slate-400 italic text-[11px] mt-1">"{fraseDoDia}"</p>
        </div>
        <div className="bg-green-50 text-green-600 px-4 py-1 rounded-full text-[10px] font-black uppercase mt-4 md:mt-0 animate-pulse">Sistema Online</div>
      </div>

      <LayoutGroup>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="space-y-6">
            {/* GESTÃO DE OPERADORES (FIREBASE) */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl text-white">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Quem está operando?</label>
              <select 
                className="w-full mt-3 p-4 rounded-2xl bg-slate-800 font-bold outline-none ring-2 ring-blue-500/20 focus:ring-blue-500 transition-all cursor-pointer"
                onChange={(e) => setOperadorAtual(operadoresDB.find(o => o.id === e.target.value))}
                value={operadorAtual?.id || ''}
              >
                <option value="">SELECIONE SEU NOME...</option>
                {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
              </select>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Novo Membro na Equipe:</p>
                <div className="flex gap-2">
                  <input className="flex-1 bg-slate-800 p-3 rounded-xl text-xs font-bold outline-none" placeholder="NOME..." value={novoOperadorNome} onChange={e => setNovoOperadorNome(e.target.value)} />
                  <button onClick={cadastrarNovoOperador} className="bg-blue-600 px-4 rounded-xl text-[10px] font-black hover:bg-blue-700">ADD</button>
                </div>
              </div>
            </div>

            {/* LANÇAMENTO */}
            <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 transition-all ${!operadorAtual ? 'opacity-30 grayscale cursor-not-allowed' : 'opacity-100'}`}>
              <h2 className="text-xl font-black mb-6 uppercase italic">Lançar Demanda</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} required className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold uppercase focus:border-blue-500 outline-none" placeholder="CIDADE" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                <input list="s-serv" required className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="SERVIÇO" value={formData.servico} onChange={e => setFormData({...formData, servico: e.target.value})} />
                <datalist id="s-serv">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC"].map(s => <option key={s} value={s} />)}
                </datalist>
                <input className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="FONTE (Opcional)" value={formData.fonte} onChange={e => setFormData({...formData, fonte: e.target.value})} />
                <button type="submit" disabled={!operadorAtual} className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black shadow-lg shadow-blue-100 uppercase text-xs tracking-widest hover:bg-blue-700 transition-all active:scale-95">Lançar na Fila</button>
              </form>
            </div>

            {/* FECHAMENTO DE METAS */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100">
              <h3 className="text-[10px] font-black uppercase mb-4 text-slate-400 text-center tracking-[0.2em]">Relatório de Fechamento</h3>
              <div className="space-y-3">
                <input type="date" className="w-full p-3 border rounded-xl text-sm font-bold bg-slate-50 outline-none" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
                <select className="w-full p-3 border rounded-xl text-sm font-bold bg-slate-50 outline-none" value={filtroOperadorRelatorio} onChange={e => setFiltroOperadorRelatorio(e.target.value)}>
                  <option value="TODOS">TODOS OS OPERADORES</option>
                  {[...new Set(historico.map(h => h.responsavel))].map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <button onClick={exportarRelatorio} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold text-[10px] uppercase hover:bg-black shadow-xl transition-all">Baixar Atividades</button>
              </div>
            </div>
          </div>

          {/* PAINEL CENTRAL (FILA) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center mb-6 px-4">
              <h2 className="text-2xl font-black uppercase text-slate-300 italic tracking-tighter">Fila de Atendimento</h2>
              <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase">{filaAtiva.length} Pendentes</span>
            </div>
            
            <AnimatePresence mode='popLayout'>
              {filaAtiva.map((c, index) => (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                  className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] shadow-lg border-l-[15px] bg-white transition-all 
                    ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
                >
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px]">#{index + 1}</span>
                      <h3 className="font-black text-xl uppercase text-slate-800 tracking-tighter">{c.orgao}</h3>
                    </div>
                    <p className="font-black text-blue-600 uppercase text-xs mt-1 ml-11">{c.servico}</p>
                    {c.responsavel && (
                      <div className="ml-11 mt-3 flex items-center gap-2">
                        <span className="text-[9px] font-black px-3 py-1 rounded-full bg-orange-100 text-orange-600 uppercase italic">
                          Em produção por: {c.responsavel}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 md:mt-0 flex gap-2">
                    {c.status === 'RECEBIDO' ? (
                      <button onClick={() => alterarStatus(c.id, 'PRODUCAO')} className="bg-orange-500 text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase shadow-lg shadow-orange-100 hover:scale-105 transition-all">Iniciar</button>
                    ) : (
                      <button onClick={() => alterarStatus(c.id, 'CONCLUIDO')} className="bg-green-500 text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase shadow-lg shadow-green-100 hover:scale-105 transition-all">Finalizar</button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* HISTÓRICO DISCRETO */}
            <div className="mt-12 bg-slate-200/30 p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="w-full text-center font-black uppercase text-[10px] text-slate-400 hover:text-blue-500 transition-all tracking-widest">
                 {mostrarHistorico ? '▲ Ocultar Histórico' : '▼ Ver Demandas Concluídas Hoje'}
               </button>
               <AnimatePresence>
                 {mostrarHistorico && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-8 space-y-4">
                     {historico.slice().reverse().map(item => (
                       <div key={item.id} className="bg-white/60 p-4 rounded-2xl flex justify-between items-center border border-white">
                         <div>
                           <p className="font-black text-slate-700 uppercase text-[11px]">{item.orgao}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{item.servico} • Por: {item.responsavel}</p>
                         </div>
                         <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full">OK</span>
                       </div>
                     ))}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}

export default App;
