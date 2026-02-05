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
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  const orgaoInputRef = useRef(null);

  // FRASES MOTIVACIONAIS
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

  // EXPORTAR RELATÓRIO
  const exportarRelatorio = () => {
    const tarefasFiltradas = contratos.filter(c => {
      const dataTarefa = c.finished_at?.split('T')[0];
      return c.status === 'CONCLUIDO' && dataTarefa === filtroData;
    });

    if (tarefasFiltradas.length === 0) return alert("Nenhuma tarefa concluída nesta data.");

    let conteudo = `RELATÓRIO DE DEMANDAS - DATA: ${filtroData}\n\n`;
    tarefasFiltradas.forEach((t, i) => {
      conteudo += `${i+1}. ${t.orgao} | SERVIÇO: ${t.servico} | RESP: ${t.responsavel}\n`;
    });

    const blob = new Blob([conteudo], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${filtroData}.txt`;
    link.click();
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans text-slate-900">
      
      {/* HEADER MOTIVACIONAL */}
      <div className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-sm font-black text-blue-600 uppercase tracking-[0.3em]">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>
          <p className="text-slate-500 italic font-medium mt-1">"{fraseDoDia}"</p>
        </div>
        <div className="mt-4 md:mt-0 bg-blue-50 px-6 py-2 rounded-full border border-blue-100">
          <span className="text-xs font-black text-blue-700 uppercase">Status: Operacional 🚀</span>
        </div>
      </div>

      <LayoutGroup>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PAINEL LATERAL */}
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl">
              <label className="text-[10px] font-black uppercase text-blue-400">Configuração do Operador</label>
              <input className="w-full bg-slate-800 border-none rounded-2xl p-4 mt-2 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="SEU NOME..." value={operador} onChange={(e) => setOperador(e.target.value)} />
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
              <h2 className="text-xl font-black mb-6 uppercase italic decoration-blue-500 underline underline-offset-8">Lançar Demanda</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold uppercase outline-none focus:border-blue-500 transition-all" placeholder="CIDADE (Ex: Itajuipe)" onChange={e => setFormData({...formData, orgao: e.target.value})} value={formData.orgao} />
                <input list="s-serv" className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="SERVIÇO" onChange={e => setFormData({...formData, servico: e.target.value})} value={formData.servico} />
                <datalist id="s-serv">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC"].map(s => <option key={s} value={s} />)}
                </datalist>
                <input className="w-full p-4 border-2 border-slate-50 rounded-2xl bg-slate-50 font-bold outline-none focus:border-blue-500" placeholder="FONTE" onChange={e => setFormData({...formData, fonte: e.target.value})} value={formData.fonte} />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black shadow-lg transition-all uppercase text-xs tracking-widest">Registrar na Fila</button>
              </form>
            </div>

            {/* RELATÓRIO EXPRESSO */}
            <div className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-100">
              <h3 className="text-xs font-black uppercase mb-4 text-slate-400">Exportar Tarefas do Dia</h3>
              <input type="date" className="w-full p-3 border rounded-xl mb-3 text-sm font-bold" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
              <button onClick={exportarRelatorio} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-xl font-bold text-[10px] uppercase transition-all">Download Relatório .TXT</button>
            </div>
          </div>

          {/* FILA DE PRODUÇÃO */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-black uppercase text-slate-300 italic mb-4">Fila de Prioridade</h2>
            
            <AnimatePresence mode='popLayout'>
              {filaAtiva.map((c, index) => (
                <motion.div 
                  key={c.id} layout initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.5 }}
                  className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] shadow-lg border-l-[15px] bg-white transition-all 
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
                    {c.status === 'RECEBIDO' ? (
                      <button onClick={() => alterarStatus(c.id, 'PRODUCAO')} className="bg-orange-500 text-white font-black py-3 px-6 rounded-2xl text-[10px] uppercase shadow-md hover:scale-105 transition-all">Iniciar</button>
                    ) : (
                      <button onClick={() => alterarStatus(c.id, 'CONCLUIDO')} className="bg-green-500 text-white font-black py-3 px-6 rounded-2xl text-[10px] uppercase shadow-md hover:scale-105 transition-all">Finalizar</button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* ARQUIVO MORTO AGRUPADO POR OPERADOR */}
            <div className="mt-12 bg-white/40 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="w-full text-center font-black uppercase text-xs text-slate-400 hover:text-blue-500 transition-all">
                 {mostrarHistorico ? '▲ Fechar Arquivo Morto' : '▼ Abrir Arquivo Morto (Concluídos)'}
               </button>

               <AnimatePresence>
                 {mostrarHistorico && (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 space-y-8">
                     {/* Agrupamento por Operador */}
                     {[...new Set(historico.map(h => h.responsavel))].map(resp => (
                       <div key={resp} className="space-y-3">
                         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 w-fit px-3 py-1 rounded-full italic">Demandas de {resp || 'EQUIPE'}</h4>
                         {historico.filter(h => h.responsavel === resp).map(item => (
                           <div key={item.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-50">
                             <div>
                               <p className="font-black text-slate-700 uppercase text-xs">{item.orgao}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{item.servico}</p>
                             </div>
                             <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded">CHECK ✅</span>
                           </div>
                         ))}
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
