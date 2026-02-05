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
    if (nome) {
      await addDoc(collection(db, "operadores"), { nome: nome.toUpperCase().trim() });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!operadorAtual) return alert("Selecione um operador!");
    
    let cidadeFinal = formData.orgao.toUpperCase();
    if (!cidadeFinal.startsWith('PM ')) cidadeFinal = `PM ${cidadeFinal}`;

    await addDoc(collection(db, "contratos"), {
      orgao: cidadeFinal, 
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

  const dadosFiltradosRelatorio = contratos.filter(c => {
    const dataMatch = c.finished_at?.split('T')[0] === filtroData;
    const operadorMatch = filtroOperador === 'TODOS' || c.responsavel === filtroOperador;
    return c.status === 'CONCLUIDO' && dataMatch && operadorMatch;
  });

  const exportarRelatorio = (tipo) => {
    if (dadosFiltradosRelatorio.length === 0) return alert("Nada para exportar.");
    if (tipo === 'excel') {
      const ws = XLSX.utils.json_to_sheet(dadosFiltradosRelatorio.map(t => ({ Orgão: t.orgao, Serviço: t.servico, Origem: t.fonte, Operador: t.responsavel, Hora: formatarData(t.finished_at) })));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
      XLSX.writeFile(wb, `Relatorio_${filtroData}.xlsx`);
    } else {
      const docPDF = new jsPDF();
      docPDF.autoTable({ 
        head: [['Cidade', 'Serviço', 'Origem', 'Operador', 'Conclusão']], 
        body: dadosFiltradosRelatorio.map(t => [t.orgao, t.servico, t.fonte, t.responsavel, formatarData(t.finished_at)]) 
      });
      docPDF.save(`Relatorio_${filtroData}.pdf`);
    }
  };

  const filaAtiva = contratos.filter(c => c.status !== 'CONCLUIDO');

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans text-slate-700">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-6">
          {/* LOGIN OPERADOR */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            {!operadorAtual ? (
              <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100" 
                onChange={(e) => {
                  const selected = operadoresDB.find(o => o.id === e.target.value);
                  if (selected) setOperadorAtual(selected);
                }}>
                <option value="">QUEM ESTÁ OPERANDO?</option>
                {operadoresDB.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
              </select>
            ) : (
              <div className="flex items-center justify-between bg-blue-600 p-4 rounded-2xl text-white shadow-lg">
                <span className="font-black uppercase text-sm">{operadorAtual.nome}</span>
                <button onClick={() => setOperadorAtual(null)} className="bg-white/20 px-3 py-1 rounded-full font-black text-xs">SAIR</button>
              </div>
            )}
          </div>

          {/* LANÇAMENTO */}
          <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 ${!operadorAtual ? 'opacity-30 pointer-events-none' : ''}`}>
             <h2 className="text-xs font-black mb-4 uppercase text-slate-400 text-center tracking-widest italic">Lançar Demanda</h2>
             <form onSubmit={handleSubmit} className="space-y-3">
                <input ref={orgaoInputRef} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none text-sm" placeholder="CIDADE" value={formData.orgao} onChange={e => setFormData({...formData, orgao: e.target.value})} />
                <input list="servs" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-sm" placeholder="SERVIÇO" value={formData.servico} onChange={e => setFormData({...formData, servico: e.target.value})} />
                <datalist id="servs">
                   {["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC", "PROPOSTA"].map(s => <option key={s} value={s} />)}
                </datalist>
                <input required className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none text-sm" placeholder="FONTE (ORIGEM)" value={formData.fonte} onChange={e => setFormData({...formData, fonte: e.target.value})} />
                <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Registrar</button>
             </form>
          </div>

          {/* RELATÓRIOS / PRÉVIA */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-[10px] font-black uppercase mb-4 text-slate-400 text-center tracking-widest">Visualizar Relatórios</h3>
            <div className="space-y-2 mb-4">
              <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
              <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={filtroOperador} onChange={e => setFiltroOperador(e.target.value)}>
                <option value="TODOS">TODOS OS OPERADORES</option>
                {operadoresDB.map(op => <option key={op.id} value={op.nome}>{op.nome}</option>)}
              </select>
            </div>
            
            <div className="max-h-40 overflow-y-auto border-y border-slate-50 my-4 py-2">
              {dadosFiltradosRelatorio.length > 0 ? (
                dadosFiltradosRelatorio.map(d => (
                  <div key={d.id} className="text-[9px] border-b border-slate-50 py-1 flex justify-between uppercase">
                    <span className="font-bold">{d.orgao}</span>
                    <span className="text-slate-400">{d.responsavel}</span>
                  </div>
                ))
              ) : (
                <p className="text-[9px] text-center text-slate-300 py-2 italic">Sem registros.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => exportarRelatorio('excel')} className="bg-[#21a366] text-white p-2 rounded-xl font-black text-[9px] uppercase">Excel</button>
              <button onClick={() => exportarRelatorio('pdf')} className="bg-[#ef4444] text-white p-2 rounded-xl font-black text-[9px] uppercase">PDF</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-2xl font-black uppercase text-slate-200 italic tracking-tighter">Fila de Produção</h2>
            <button onClick={handleLoginAdmin} className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{isAdmin ? '● ADM LOGADO' : 'ADM'}</button>
          </div>

          {isAdmin && (
             <div className="bg-white p-4 rounded-3xl border border-slate-200 mb-4 flex gap-2 overflow-x-auto">
                <button onClick={cadastrarNovoOperador} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap">+ ADICIONAR OPERADOR</button>
                {operadoresDB.map(op => (
                  <div key={op.id} className="bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-2">
                    <span className="text-[9px] font-bold">{op.nome}</span>
                    <button onClick={async () => { if(window.confirm("Remover?")) await deleteDoc(doc(db, "operadores", op.id)) }} className="text-red-500 text-[10px]">✕</button>
                  </div>
                ))}
             </div>
          )}

          <AnimatePresence>
            {filaAtiva.map((c, index) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-[2rem] bg-white shadow-sm border-l-[12px] ${c.status === 'RECEBIDO' ? 'border-red-500' : 'border-orange-500'}`}
              >
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px]">#{index + 1}</span>
                    <h3 className="font-black text-lg uppercase text-slate-700 tracking-tighter">{c.orgao}</h3>
                    {isAdmin && <button onClick={async () => { if(window.confirm("Apagar?")) await deleteDoc(doc(db, "contratos", c.id)) }} className="text-red-300 hover:text-red-500 text-[9px] font-bold">X</button>}
                  </div>
                  <div className="flex gap-2 items-center mt-1 ml-9">
                    <p className="font-black text-blue-500 uppercase text-[10px]">{c.servico}</p>
                    <span className="text-slate-400 text-[9px] font-bold px-2 bg-slate-50 rounded italic">Origem: {c.fonte}</span>
                  </div>
                  {c.responsavel && <p className="text-[8px] font-black text-orange-400 uppercase mt-2 ml-9">Operador: {c.responsavel}</p>}
                </div>
                <div className="mt-4 md:mt-0">
                  <button onClick={() => alterarStatus(c.id, c.status === 'RECEBIDO' ? 'PRODUCAO' : 'CONCLUIDO')} 
                    className={`${c.status === 'RECEBIDO' ? 'bg-orange-500' : 'bg-green-500'} text-white font-black py-4 px-8 rounded-2xl text-[10px] uppercase shadow-lg transition-transform active:scale-95`}>
                    {c.status === 'RECEBIDO' ? 'Iniciar' : 'Finalizar'}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="mt-12 bg-slate-100/30 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="w-full text-center font-black uppercase text-[10px] text-slate-400 tracking-widest hover:text-slate-500">
              {mostrarHistorico ? '▲ Recolher Histórico' : '▼ Ver Histórico Completo'}
            </button>
            {mostrarHistorico && (
              <div className="mt-6 space-y-2">
                {contratos.filter(c => c.status === 'CONCLUIDO').slice().reverse().map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-[1.5rem] flex justify-between items-center shadow-sm border border-slate-50">
                    <div className="flex-1">
                      <p className="font-black text-slate-600 uppercase text-[10px]">{item.orgao}</p>
                      <p className="text-[9px] font-bold text-blue-400 uppercase">{item.servico} <span className="text-slate-300 ml-1">({item.fonte})</span></p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Por: {item.responsavel}</span>
                      <span className="text-[9px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-full mt-1">✓ {formatarData(item.finished_at)}</span>
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
