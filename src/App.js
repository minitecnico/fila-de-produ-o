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
  const [isAdmin, setIsAdmin] = useState(false);
  const orgaoInputRef = useRef(null);

  useEffect(() => {
    const unsubContratos = onSnapshot(query(collection(db, "contratos"), orderBy("created_at", "asc")), (snap) => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOps = onSnapshot(query(collection(db, "operadores"), orderBy("nome", "asc")), (snap) => {
      setOperadoresDB(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubContratos(); unsubOps(); };
  }, []);

  const formatarData = (iso) => {
    if (!iso) return "--/--";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleLoginAdmin = () => {
    const pass = prompt("Digite a Senha Mestra:");
    if (pass === "tpshow26") setIsAdmin(true);
    else alert("Acesso Negado.");
  };

  const cadastrarNovoOperador = async () => {
    const nome = prompt("Nome do novo operador:");
    if (nome) await addDoc(collection(db, "operadores"), { nome: nome.toUpperCase().trim() });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operadorAtual) return alert("Selecione um operador no topo!");
    let cidade = formData.orgao.toUpperCase();
    if (cidade && !cidade.startsWith('PM ')) cidade = `PM ${cidade}`;
    await addDoc(collection(db, "contratos"), {
      orgao: cidade, servico: formData.servico.toUpperCase(), status: 'RECEBIDO', responsavel: '', created_at: serverTimestamp()
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

  const deletarAtividade = async (id) => { if(window.confirm("Apagar permanentemente?")) await deleteDoc(doc(db, "contratos", id)); };
  const deletarUsuario = async (id) => { if(window.confirm("Remover operador?")) await deleteDoc(doc(db, "operadores", id)); };
  const renomearUsuario = async (id, antigo) => {
    const novo = prompt("Novo nome para " + antigo + ":");
    if(novo) await updateDoc(doc(db, "operadores", id), { nome: novo.toUpperCase() });
  };

  const exportarRelatorio = (tipo) => {
    const filtrados = contratos.filter(c => c.status === 'CONCLUIDO' && c.finished_at?.split('T')[0] === filtroData);
    if (tipo === 'excel') {
      const ws = XLSX.utils.json_to_sheet(filtrados.map(t => ({ Orgão: t.orgao, Serviço: t.servico, Operador: t.responsavel, Hora: formatarData(t.finished_at) })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Fila");
      XLSX.writeFile(wb, `Relatorio_${filtroData}.xlsx`);
    } else {
      const docPDF = new jsPDF();
      docPDF.autoTable({ head: [['Cidade', 'Serviço', 'Operador', 'Conclusão']], body: filtrados.map(t => [t.orgao, t.servico, t.responsavel, formatarData(t.finished_at)]) });
      docPDF.save(`Relatorio_${filtroData}.pdf`);
    }
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');
  const historico = contratos.filter(c => c.status === 'CONCLUIDO');

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-slate-700">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-6">
          {/* PAINEL ADMIN MESTRE */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase text-slate-400">ADM Master</h3>
              {!isAdmin ? (
                <button onClick={handleLoginAdmin} className="text-[9px] bg-slate-100 px-3 py-1 rounded-full font-bold hover:bg-slate-200">Login</button>
              ) : (
                <button onClick={() => setIsAdmin(false)} className="text-[9px] bg-red-50 text-red-500 px-3 py-1 rounded-full font-bold">Sair</button>
              )}
            </div>
            {isAdmin && (
              <div className="space-y-3 animate-pulse">
                <p className="text-[9px] font-bold text-blue-500 uppercase italic">Gerir Operadores:</p>
                {operadoresDB.map(op => (
                  <div key={op.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black truncate max-w-[100px]">{op.nome}</span>
                    <div className="flex gap-1">
                      <button onClick={() => renomearUsuario(op.id, op.nome)} className="bg-blue-500 text-white px-2 py-1 rounded-lg text-[10px]">✏️</button>
                      <button onClick={() => deletarUsuario(op.id)} className="bg-red-500 text-white px-2 py-1 rounded-lg text-[10px]">🗑️</button>
                    </div>
                  </div>
                ))}
                <button onClick={cadastrarNovoOperador} className="w-full bg-slate-900 text-white p-2 rounded-xl text-[10px] font-black uppercase mt-2">+ Novo Operador</button>
              </div>
            )}
          </div>

          {/* SELEÇÃO OPERADOR */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Quem está operando?</label>
            <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100" 
              onChange={(e) => setOperadorAtual(operadoresDB.find(o => o.id === e.target.value))} 
              value={operadorAtual?.id || ''}>
              <option value="">SELECIONE SEU NOME...</option>
              {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
            </select>
          </div>

          {/* LANÇAMENTO */}
          <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 transition-all ${!operadorAtual ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
             <h2 className="text-lg font-black mb-6 uppercase italic text-slate-400 text-center">Lançar Demanda</h2>
             <form onSubmit={handleSubmit} className="space-y-4">
                <input ref={orgaoInputRef} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none border border-transparent focus:border-slate-200" placeholder="CIDADE" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                <input list="servs" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-transparent focus:border-slate-200" placeholder="SERVIÇO" value={formData.servico} onChange={e => setFormData({...formData, servico: e.target.value})} />
                <datalist id="servs">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC"].map(s => <option key={s} value={s} />)}
                </datalist>
                <button type="submit" className="w-full bg-slate-800 text-white p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Registrar na Fila</button>
             </form>
          </div>

          {/* EXPORTAÇÃO */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-[9px] font-black uppercase mb-4 text-slate-300 text-center">Exportar Relatórios</h3>
            <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none mb-3 border border-slate-100" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => exportarRelatorio('excel')} className="bg-[#21a366] text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-sm">Excel</button>
              <button onClick={() => exportarRelatorio('pdf')} className="bg-[#ef4444] text-white p-3 rounded-xl font-black text-[10px] uppercase shadow-sm">PDF</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-black uppercase text-slate-300 italic px-4">Painel de Atendimento</h2>
          
          <AnimatePresence>
            {filaAtiva.map((c, index) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] bg-white shadow-sm border-l-[12px] ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
              >
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-900 text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px]">#{index + 1}</span>
                    <h3 className="font-black text-lg uppercase text-slate-700">{c.orgao}</h3>
                    {isAdmin && <button onClick={() => deletarAtividade(c.id)} className="text-red-300 hover:text-red-500 text-[10px] uppercase font-bold">Excluir</button>}
                  </div>
                  <p className="font-black text-blue-500 uppercase text-[11px] mt-1 ml-10">{c.servico}</p>
                  {c.responsavel && <p className="text-[9px] font-black text-orange-400 uppercase mt-2 ml-10 italic">Em produção: {c.responsavel}</p>}
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                  {c.status === 'RECEBIDO' ? (
                    <button onClick={() => alterarStatus(c.id, 'PRODUCAO')} className="bg-orange-500 text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase shadow-md active:scale-95 transition-all">Iniciar</button>
                  ) : (
                    <button onClick={() => alterarStatus(c.id, 'CONCLUIDO')} className="bg-green-500 text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase shadow-md active:scale-95 transition-all">Finalizar</button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-12 bg-slate-100/50 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="w-full text-center font-black uppercase text-[10px] text-slate-400 tracking-widest hover:text-slate-600">
              {mostrarHistorico ? '▲ Ocultar Histórico' : '▼ Ver Concluídos'}
            </button>
            {mostrarHistorico && (
              <div className="mt-6 space-y-3">
                {historico.slice().reverse().map(item => (
                  <div key={item.id} className="bg-white p-5 rounded-[1.5rem] flex justify-between items-center shadow-sm border border-slate-50">
                    <div>
                      <p className="font-black text-slate-600 uppercase text-[11px]">{item.orgao}</p>
                      <p className="text-[9px] font-bold text-blue-400 uppercase">{item.servico}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Por: {item.responsavel}</span>
                      <span className="text-[10px] font-bold text-green-500 bg-green-50 px-3 py-1 rounded-full mt-1">✓ {formatarData(item.finished_at)}</span>
                      {isAdmin && <button onClick={() => deletarAtividade(item.id)} className="text-[8px] text-red-300 mt-2 uppercase font-bold hover:text-red-500">Remover Log</button>}
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
