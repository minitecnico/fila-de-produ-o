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
  const [operadorAtual, setOperadorAtual] = useState(null);
  const [formData, setFormData] = useState({ orgao: '', servico: '', fonte: '' });
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  const [filtroOperador, setFiltroOperador] = useState('TODOS');
  const [isAdmin, setIsAdmin] = useState(false);
  const orgaoInputRef = useRef(null);

  // Carregamento de dados
  useEffect(() => {
    const unsubContratos = onSnapshot(query(collection(db, "contratos"), orderBy("created_at", "asc")), (snap) => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOps = onSnapshot(query(collection(db, "operadores"), orderBy("nome", "asc")), (snap) => {
      setOperadoresDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubContratos(); unsubOps(); };
  }, []);

  // Lista única de origens para o Auto-complete (Sincronizado)
  const sugestoesOrigem = [...new Set(contratos.map(c => c.fonte))].filter(Boolean);

  const formatarData = (iso) => {
    if (!iso) return "--/--";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleLoginAdmin = () => {
    const pass = prompt("Senha Mestra:");
    if (pass === "tpshow26") setIsAdmin(true);
    else alert("Acesso Negado.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operadorAtual) return alert("Selecione um operador no topo!");
    
    let cidade = formData.orgao.toUpperCase();
    if (!cidade.startsWith('PM ')) cidade = `PM ${cidade}`;

    await addDoc(collection(db, "contratos"), {
      orgao: cidade, 
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

  // Lógica de Visualização do Relatório
  const dadosRelatorio = contratos.filter(c => {
    const dataMatch = c.finished_at?.split('T')[0] === filtroData;
    const operadorMatch = filtroOperador === 'TODOS' || c.responsavel === filtroOperador;
    return c.status === 'CONCLUIDO' && dataMatch && operadorMatch;
  });

  const exportar = (tipo) => {
    if (dadosRelatorio.length === 0) return alert("Nada para exportar.");
    if (tipo === 'excel') {
      const ws = XLSX.utils.json_to_sheet(dadosRelatorio.map(t => ({ Cidade: t.orgao, Serviço: t.servico, Origem: t.fonte, Operador: t.responsavel, Hora: formatarData(t.finished_at) })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Produção");
      XLSX.writeFile(wb, `Relatorio_${filtroData}.xlsx`);
    } else {
      const docPDF = new jsPDF();
      docPDF.autoTable({ head: [['Cidade', 'Serviço', 'Origem', 'Operador', 'Conclusão']], body: dadosRelatorio.map(t => [t.orgao, t.servico, t.fonte, t.responsavel, formatarData(t.finished_at)]) });
      docPDF.save(`Relatorio_${filtroData}.pdf`);
    }
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-6">
          {/* LOGIN OPERADOR FIXO */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block italic">Operador Logado:</label>
            {!operadorAtual ? (
              <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100" 
                onChange={(e) => setOperadorAtual(operadoresDB.find(o => o.id === e.target.value))}>
                <option value="">QUEM VAI OPERAR?</option>
                {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
              </select>
            ) : (
              <div className="flex items-center justify-between bg-blue-600 p-4 rounded-2xl text-white shadow-lg">
                <span className="font-black uppercase text-sm">{operadorAtual.nome}</span>
                <button onClick={() => setOperadorAtual(null)} className="bg-white/20 px-3 py-1 rounded-full font-black text-[10px] hover:bg-white/40">SAIR</button>
              </div>
            )}
          </div>

          {/* LANÇAMENTO */}
          <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 ${!operadorAtual ? 'opacity-30 pointer-events-none' : ''}`}>
             <h2 className="text-xs font-black mb-6 uppercase text-slate-400 text-center tracking-widest italic">Lançar Atividade</h2>
             <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none text-sm" placeholder="CIDADE / ÓRGÃO" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                
                <input list="servs" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-sm" placeholder="SERVIÇO" value={formData.servico} onChange={e => setFormData({...formData, servico: e.target.value})} />
                <datalist id="servs">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC", "PROPOSTA"].map(s => <option key={s} value={s} />)}
                </datalist>

                {/* CAMPO ORIGEM COM AUTO-COMPLETE DO FIREBASE */}
                <input list="fontes" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none text-sm" placeholder="ORIGEM / FONTE" value={formData.fonte} onChange={e => setFormData({...formData, fonte: e.target.value})} />
                <datalist id="fontes">
                   {sugestoesOrigem.map(f => <option key={f} value={f} />)}
                </datalist>

                <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Lançar na Fila</button>
             </form>
          </div>

          {/* RELATÓRIOS E VISUALIZAÇÃO */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-[10px] font-black uppercase mb-4 text-slate-400 text-center tracking-widest italic">Relatórios de Produção</h3>
            <div className="space-y-2 mb-4">
              <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
              
              {/* SELETOR DE OPERADOR PARA O RELATÓRIO */}
              <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100" value={filtroOperador} onChange={e => setFiltroOperador(e.target.value)}>
                <option value="TODOS">TODOS OS OPERADORES</option>
                {operadoresDB.map(op => <option key={op.id} value={op.nome}>{op.nome}</option>)}
              </select>
            </div>
            
            <div className="max-h-52 overflow-y-auto border-y border-slate-50 my-4 py-2">
              <p className="text-[8px] font-black text-slate-300 mb-2 uppercase tracking-widest text-center">Visualização Rápida</p>
              {dadosRelatorio.length > 0 ? (
                dadosRelatorio.map(d => (
                  <div key={d.id} className="text-[9px] border-b border-slate-50 py-2 flex justify-between items-center">
                    <div>
                      <span className="font-black text-slate-600 block uppercase">{d.orgao}</span>
                      <span className="text-blue-500 font-bold uppercase">{d.servico}</span>
                    </div>
                    <span className="text-slate-400 font-bold">{formatarData(d.finished_at).split(' - ')[1]}</span>
                  </div>
                ))
              ) : (
                <p className="text-[9px] text-center text-slate-300 py-6 italic">Nenhuma produção encontrada.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => exportar('excel')} className="bg-[#21a366] text-white p-3 rounded-xl font-black text-[9px] uppercase shadow-sm active:scale-95">Baixar Excel</button>
              <button onClick={() => exportar('pdf')} className="bg-[#ef4444] text-white p-3 rounded-xl font-black text-[9px] uppercase shadow-sm active:scale-95">Baixar PDF</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-black uppercase text-slate-300 italic tracking-tighter">Painel de Atendimento</h2>
            <button onClick={handleLoginAdmin} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all">{isAdmin ? '● ADM ATIVO' : 'Painel ADM'}</button>
          </div>

          <AnimatePresence>
            {filaAtiva.map((c, index) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2.5rem] bg-white shadow-sm border-l-[15px] ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
              >
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-900 text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px]">#{index + 1}</span>
                    <h3 className="font-black text-xl uppercase text-slate-700 tracking-tighter italic">{c.orgao}</h3>
                    {isAdmin && <button onClick={async () => { if(window.confirm("Apagar demanda?")) await deleteDoc(doc(db, "contratos", c.id)) }} className="text-red-300 hover:text-red-500 text-[10px] font-bold uppercase ml-auto">Excluir</button>}
                  </div>
                  <div className="flex gap-2 items-center mt-2 ml-10">
                    <p className="font-black text-blue-500 uppercase text-[11px]">{c.servico}</p>
                    <span className="text-slate-400 text-[10px] font-black bg-slate-100 px-3 py-0.5 rounded uppercase italic">Origem: {c.fonte}</span>
                  </div>
                  {c.responsavel && <p className="text-[9px] font-black text-orange-400 uppercase mt-2 ml-10 tracking-widest italic animate-pulse">● EM PRODUÇÃO: {c.responsavel}</p>}
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                  <button onClick={() => alterarStatus(c.id, c.status === 'RECEBIDO' ? 'PRODUCAO' : 'CONCLUIDO')} 
                    className={`${c.status === 'RECEBIDO' ? 'bg-orange-500 shadow-orange-100' : 'bg-green-500 shadow-green-100'} text-white font-black py-4 px-10 rounded-2xl text-[11px] uppercase shadow-lg transition-all active:scale-95`}>
                    {c.status === 'RECEBIDO' ? 'Iniciar' : 'Concluir'}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ÁREA DE HISTÓRICO RECOLHÍVEL */}
          <div className="mt-12 bg-slate-200/50 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-300">
            <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="w-full text-center font-black uppercase text-[10px] text-slate-500 tracking-widest hover:text-slate-700">
              {mostrarHistorico ? '▲ FECHAR HISTÓRICO' : '▼ VER HISTÓRICO DE HOJE'}
            </button>
            {mostrarHistorico && (
              <div className="mt-6 space-y-3">
                {contratos.filter(c => c.status === 'CONCLUIDO').slice().reverse().map(item => (
                  <div key={item.id} className="bg-white p-5 rounded-[1.8rem] flex justify-between items-center shadow-sm border border-slate-50">
                    <div>
                      <p className="font-black text-slate-600 uppercase text-[12px] italic">{item.orgao}</p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">{item.servico} <span className="text-slate-300 ml-1">| {item.fonte}</span></p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Operador: {item.responsavel}</span>
                      <span className="text-[10px] font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full mt-1 italic">✓ {formatarData(item.finished_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
