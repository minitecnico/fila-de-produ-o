import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  updateDoc, doc, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function App() {
  const [contratos, setContratos] = useState([]);
  const [operadoresDB, setOperadoresDB] = useState([]);
  const [servicosDB, setServicosDB] = useState([]);
  const [origensDB, setOrigensDB] = useState([]);
  const [operadorAtual, setOperadorAtual] = useState(null);
  const [formData, setFormData] = useState({ orgao: '', servico: '', fonte: '' });
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  const [filtroOperador, setFiltroOperador] = useState('TODOS');
  const [isAdmin, setIsAdmin] = useState(false);
  const orgaoInputRef = useRef(null);

  useEffect(() => {
    const unsubContratos = onSnapshot(query(collection(db, "contratos"), orderBy("created_at", "asc")), (snap) => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOps = onSnapshot(query(collection(db, "operadores"), orderBy("nome", "asc")), (snap) => {
      setOperadoresDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubServs = onSnapshot(query(collection(db, "lista_servicos"), orderBy("nome", "asc")), (snap) => {
      setServicosDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOrigs = onSnapshot(query(collection(db, "lista_origens"), orderBy("nome", "asc")), (snap) => {
      setOrigensDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubContratos(); unsubOps(); unsubServs(); unsubOrigs(); };
  }, []);

  const formatarData = (iso) => {
    if (!iso) return "--/--";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const addItemADM = async (colecao) => {
    const valor = prompt(`Adicionar novo item em ${colecao.split('_')[1].toUpperCase()}:`);
    if (valor) await addDoc(collection(db, colecao), { nome: valor.toUpperCase().trim() });
  };

  const removerItemADM = async (colecao, id) => {
    if (window.confirm("Deseja realmente excluir este item?")) await deleteDoc(doc(db, colecao, id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operadorAtual) return alert("Selecione um operador!");
    let cidade = formData.orgao.toUpperCase().startsWith('PM ') ? formData.orgao.toUpperCase() : `PM ${formData.orgao.toUpperCase()}`;
    await addDoc(collection(db, "contratos"), {
      orgao: cidade, 
      servico: formData.servico.toUpperCase(), 
      fonte: formData.fonte.toUpperCase(), 
      status: 'RECEBIDO', responsavel: '', created_at: serverTimestamp()
    });
    setFormData({ orgao: '', servico: '', fonte: '' });
    orgaoInputRef.current?.focus();
  };

  const dadosRelatorio = contratos.filter(c => {
    const dataMatch = c.finished_at?.split('T')[0] === filtroData;
    const operadorMatch = filtroOperador === 'TODOS' || c.responsavel === filtroOperador;
    return c.status === 'CONCLUIDO' && dataMatch && operadorMatch;
  });

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA DE CONTROLE E LANÇAMENTO */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            {!operadorAtual ? (
              <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100" 
                onChange={(e) => setOperadorAtual(operadoresDB.find(o => o.id === e.target.value))}>
                <option value="">QUEM ESTÁ OPERANDO?</option>
                {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
              </select>
            ) : (
              <div className="flex items-center justify-between bg-blue-600 p-4 rounded-2xl text-white shadow-lg">
                <span className="font-black uppercase text-sm italic">{operadorAtual.nome}</span>
                <button onClick={() => setOperadorAtual(null)} className="bg-white/20 px-3 py-1 rounded-full font-black text-xs">SAIR</button>
              </div>
            )}
          </div>

          <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 ${!operadorAtual ? 'opacity-30 pointer-events-none' : ''}`}>
             <h2 className="text-xs font-black mb-6 uppercase text-slate-400 text-center tracking-widest italic">Lançar Demanda</h2>
             <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none text-sm" placeholder="CIDADE / ÓRGÃO" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                
                <input list="servs" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-sm" placeholder="SERVIÇO" value={formData.servico} onChange={e => setFormData({...formData, servico: e.target.value})} />
                <datalist id="servs">
                   {servicosDB.map(s => <option key={s.id} value={s.nome} />)}
                </datalist>

                <input list="origs" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none text-sm" placeholder="ORIGEM / FONTE" value={formData.fonte} onChange={e => setFormData({...formData, fonte: e.target.value})} />
                <datalist id="origs">
                   {origensDB.map(o => <option key={o.id} value={o.nome} />)}
                </datalist>

                <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Registrar</button>
             </form>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-[10px] font-black uppercase mb-4 text-slate-400 text-center tracking-widest italic">Relatórios / Prévia</h3>
            <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none mb-2" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
            <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none mb-4" value={filtroOperador} onChange={e => setFiltroOperador(e.target.value)}>
                <option value="TODOS">TODOS OS OPERADORES</option>
                {operadoresDB.map(op => <option key={op.id} value={op.nome}>{op.nome}</option>)}
            </select>
            <div className="max-h-40 overflow-y-auto mb-4 px-2">
                {dadosRelatorio.map(d => (
                  <div key={d.id} className="text-[9px] border-b border-slate-50 py-2 flex justify-between font-bold">
                    <span className="uppercase">{d.orgao}</span>
                    <span className="text-blue-500 uppercase">{formatarData(d.finished_at).split(' - ')[1]}</span>
                  </div>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => {}} className="bg-[#21a366] text-white p-3 rounded-xl font-black text-[9px] uppercase">Excel</button>
              <button onClick={() => {}} className="bg-[#ef4444] text-white p-3 rounded-xl font-black text-[9px] uppercase">PDF</button>
            </div>
          </div>
        </div>

        {/* COLUNA PRINCIPAL / FILA */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-black uppercase text-slate-300 italic">Fila Ativa</h2>
            <button onClick={() => { if(!isAdmin) { const p = prompt("Senha:"); if(p==="tpshow26") setIsAdmin(true); } else setIsAdmin(false); }} 
              className={`text-[10px] font-black px-4 py-1 rounded-full border ${isAdmin ? 'bg-red-50 text-red-500 border-red-200' : 'text-slate-400 border-slate-200'}`}>
              {isAdmin ? 'SAIR ADM' : 'PAINEL ADM'}
            </button>
          </div>

          {/* PAINEL DE GESTÃO ADM (DINÂMICO) */}
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[2.5rem] border-2 border-blue-100 shadow-xl space-y-6">
              <h3 className="text-center font-black text-blue-600 text-xs tracking-widest uppercase">Gerenciamento de Dados</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* GESTÃO DE OPERADORES */}
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 mb-2 uppercase">Operadores</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                    {operadoresDB.map(op => (
                      <div key={op.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-[10px] font-bold">
                        <span>{op.nome}</span>
                        <button onClick={() => removerItemADM('operadores', op.id)} className="text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addItemADM('operadores')} className="w-full bg-blue-600 text-white text-[9px] font-black p-2 rounded-lg">+ ADD</button>
                </div>
                {/* GESTÃO DE SERVIÇOS */}
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 mb-2 uppercase">Serviços</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                    {servicosDB.map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-[10px] font-bold">
                        <span>{s.nome}</span>
                        <button onClick={() => removerItemADM('lista_servicos', s.id)} className="text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addItemADM('lista_servicos')} className="w-full bg-blue-600 text-white text-[9px] font-black p-2 rounded-lg">+ ADD</button>
                </div>
                {/* GESTÃO DE ORIGENS */}
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 mb-2 uppercase">Origens</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                    {origensDB.map(o => (
                      <div key={o.id} className="flex justify-between items-center bg-white p-2 rounded-lg text-[10px] font-bold">
                        <span>{o.nome}</span>
                        <button onClick={() => removerItemADM('lista_origens', o.id)} className="text-red-400">✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addItemADM('lista_origens')} className="w-full bg-blue-600 text-white text-[9px] font-black p-2 rounded-lg">+ ADD</button>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {contratos.filter(c => c.status !== 'CONCLUIDO').map((c, index) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2.5rem] bg-white shadow-sm border-l-[15px] ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}>
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px]">#{index + 1}</span>
                    <h3 className="font-black text-xl uppercase text-slate-700 italic tracking-tighter">{c.orgao}</h3>
                  </div>
                  <div className="flex gap-2 items-center mt-2 ml-9">
                    <p className="font-black text-blue-500 uppercase text-[11px]">{c.servico}</p>
                    <span className="text-slate-400 text-[10px] font-black bg-slate-100 px-3 py-0.5 rounded uppercase">Origem: {c.fonte}</span>
                  </div>
                  {c.responsavel && <p className="text-[9px] font-black text-orange-400 uppercase mt-2 ml-9 tracking-widest italic">● EM PRODUÇÃO: {c.responsavel}</p>}
                </div>
                <div className="mt-4 md:mt-0">
                  <button onClick={async () => {
                    const next = c.status === 'RECEBIDO' ? 'PRODUCAO' : 'CONCLUIDO';
                    const data = { status: next };
                    if(next === 'PRODUCAO') data.responsavel = operadorAtual.nome;
                    if(next === 'CONCLUIDO') data.finished_at = new Date().toISOString();
                    await updateDoc(doc(db, "contratos", c.id), data);
                  }} className={`${c.status === 'RECEBIDO' ? 'bg-orange-500' : 'bg-green-500'} text-white font-black py-4 px-10 rounded-2xl text-[11px] uppercase shadow-lg transition-all active:scale-95`}>
                    {c.status === 'RECEBIDO' ? 'Iniciar' : 'Concluir'}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default App;
