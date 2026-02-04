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
  const orgaoInputRef = useRef(null);

  const sugestoesServico = ["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC", "SUPORTE TÉCNICO", "TREINAMENTO"];
  const sugestoesFonte = ["Portal", "WhatsApp", "E-mail", "Telefone", "Ofício"];

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
        status: 'RECEBIDO', // COR VERMELHA
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
    await updateDoc(doc(db, "contratos", id), data);
  };

  // Filtros para as listas
  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans text-slate-900">
      <LayoutGroup>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PAINEL LATERAL */}
          <div className="space-y-6">
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-slate-900 p-5 rounded-3xl shadow-2xl text-white">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Operador Atual</label>
              <input 
                className="w-full bg-slate-800 border-none rounded-2xl p-4 mt-2 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SEU NOME..."
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
              />
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
              <h2 className="text-2xl font-black mb-8 text-slate-800 italic uppercase tracking-tighter underline decoration-blue-500 underline-offset-8">Novo Lançamento</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <input ref={orgaoInputRef} className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-bold uppercase focus:border-blue-500 outline-none transition-all" placeholder="CIDADE" onChange={e => setFormData({...formData, orgao: e.target.value})} value={formData.orgao} />
                <input list="s-serv" className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-bold focus:border-blue-500 outline-none transition-all" placeholder="SERVIÇO" onChange={e => setFormData({...formData, servico: e.target.value})} value={formData.servico} />
                <datalist id="s-serv">{sugestoesServico.map(s => <option key={s} value={s} />)}</datalist>
                <input list="s-font" className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-bold focus:border-blue-500 outline-none transition-all" placeholder="FONTE" onChange={e => setFormData({...formData, fonte: e.target.value})} value={formData.fonte} />
                <datalist id="s-font">{sugestoesFonte.map(f => <option key={f} value={f} />)}</datalist>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black shadow-lg shadow-blue-200 transition-all uppercase tracking-widest text-sm">Lançar Demanda</button>
              </form>
            </motion.div>
          </div>

          {/* FILA DE PRODUÇÃO */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-3xl font-black uppercase text-slate-300 italic tracking-tighter px-2">Painel de Controle</h2>
            
            <div className="space-y-4">
              <AnimatePresence mode='popLayout'>
                {filaAtiva.map((c) => (
                  <motion.div 
                    key={c.id} layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] shadow-lg border-l-[15px] bg-white transition-colors duration-500 
                      ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
                  >
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-2xl uppercase text-slate-800 tracking-tighter">{c.orgao}</h3>
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${c.status === 'RECEBIDO' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          {c.status === 'RECEBIDO' ? 'Aguardando' : 'Em Produção'}
                        </span>
                      </div>
                      <p className="font-black text-blue-600 uppercase text-sm mt-1">{c.servico}</p>
                      
                      <div className="flex gap-4 mt-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">🕒 {c.created_at?.toDate().toLocaleTimeString()}</span>
                        {c.responsavel && <span className="text-[10px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded">👤 {c.responsavel}</span>}
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4 md:mt-0">
                      {c.status === 'RECEBIDO' ? (
                        <button onClick={() => alterarStatus(c.id, 'PRODUCAO')} className="bg-orange-500 hover:bg-orange-600 text-white font-black py-4 px-8 rounded-2xl text-xs uppercase shadow-lg shadow-orange-100 transition-all">Iniciar</button>
                      ) : (
                        <button onClick={() => alterarStatus(c.id, 'CONCLUIDO')} className="bg-green-500 hover:bg-green-600 text-white font-black py-4 px-8 rounded-2xl text-xs uppercase shadow-lg shadow-green-100 transition-all">Finalizar</button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* HISTÓRICO DISCRETO */}
            <div className="mt-20">
              <button 
                onClick={() => setMostrarHistorico(!mostrarHistorico)}
                className="flex items-center gap-2 text-slate-400 font-black uppercase text-xs hover:text-slate-600 transition-all mb-4"
              >
                {mostrarHistorico ? '▼ Ocultar Concluídos' : '▶ Ver Histórico Concluído'} ({historico.length})
              </button>

              <AnimatePresence>
                {mostrarHistorico && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-3"
                  >
                    {historico.map(h => (
                      <motion.div 
                        layout key={h.id}
                        className="bg-white/50 border-l-8 border-green-500 p-4 rounded-2xl flex justify-between items-center opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition-all"
                      >
                        <div>
                          <h4 className="font-black text-slate-700 uppercase text-sm">{h.orgao}</h4>
                          <p className="text-[10px] font-bold text-slate-400">{h.servico} - Finalizado por {h.responsavel}</p>
                        </div>
                        <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded">Concluído ✅</span>
                      </motion.div>
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
