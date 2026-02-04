import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  updateDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [contratos, setContratos] = useState([]);
  const [formData, setFormData] = useState({ orgao: '', servico: '', fonte: '' });
  const [operador, setOperador] = useState('');
  const orgaoInputRef = useRef(null);

  const sugestoesServico = ["CONTRATO", "E-MAIL", "WhatsApp", "ADITIVO", "APRESENTAÇÃO SICC", "SUPORTE TÉCNICO", "TREINAMENTO"];
  const sugestoesFonte = ["Portal", "WhatsApp", "E-mail", "Telefone", "Ofício"];

  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("created_at", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(dados.filter(c => c.status !== 'CONCLUIDO')); 
    });
    return unsubscribe;
  }, []);

  // Lógica de comparação inteligente de nomes
  const ehOResponsavel = (nomeResponsavel) => {
    if (!nomeResponsavel || !operador) return false;
    const op = operador.trim().toUpperCase();
    const resp = nomeResponsavel.trim().toUpperCase();
    
    // Verifica se são iguais, ou se o primeiro nome bate, ou se um contém o outro
    return op === resp || resp.includes(op) || op.includes(resp.split(' ')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let nomeFinal = formData.orgao.toUpperCase();
    if (nomeFinal && !nomeFinal.startsWith('PM ')) nomeFinal = `PM ${nomeFinal}`;

    if (!nomeFinal || !formData.servico) return alert("Preencha os dados!");

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

  const iniciarDemanda = async (id) => {
    if (!operador.trim()) return alert("Identifique-se no campo OPERADOR antes de assumir!");
    await updateDoc(doc(db, "contratos", id), { 
      status: 'PRODUCAO',
      responsavel: operador.trim().toUpperCase() 
    });
  };

  const concluirDemanda = async (id, nomeResponsavel) => {
    if (!ehOResponsavel(nomeResponsavel)) {
      alert(`⚠️ Atenção: Esta demanda pertence a ${nomeResponsavel}. Somente ele(a) pode concluir.`);
      return;
    }
    await updateDoc(doc(db, "contratos", id), { status: 'CONCLUIDO' });
  };

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-6">
          {/* PAINEL DO OPERADOR - SENSO DE IDENTIDADE */}
          <div className={`p-5 rounded-2xl shadow-lg transition-all border-b-4 ${operador ? 'bg-blue-600 border-blue-800' : 'bg-slate-800 border-red-500'}`}>
            <label className="text-[10px] font-black uppercase tracking-widest text-white opacity-70">Operador Ativo</label>
            <input 
              className="w-full bg-white/10 border-none rounded-lg p-3 mt-2 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white font-bold"
              placeholder="Digite seu nome..."
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
            />
            {!operador && <p className="text-[9px] text-red-300 mt-2 font-bold animate-pulse">⚠️ Identifique-se para assumir tarefas</p>}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
            <h2 className="text-xl font-black mb-6 text-slate-700 uppercase italic">Novo Lançamento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input ref={orgaoInputRef} className="w-full p-3 border rounded-xl bg-slate-50 font-bold uppercase" placeholder="Cidade" onChange={e => setFormData({...formData, orgao: e.target.value})} value={formData.orgao} />
              <input list="listaServicos" className="w-full p-3 border rounded-xl bg-slate-50 font-bold" placeholder="Serviço" onChange={e => setFormData({...formData, servico: e.target.value})} value={formData.servico} />
              <datalist id="listaServicos">{sugestoesServico.map((s, i) => <option key={i} value={s} />)}</datalist>
              <input list="listaFontes" className="w-full p-3 border rounded-xl bg-slate-50 font-bold" placeholder="Fonte" onChange={e => setFormData({...formData, fonte: e.target.value})} value={formData.fonte} />
              <datalist id="listaFontes">{sugestoesFonte.map((f, i) => <option key={i} value={f} />)}</datalist>
              <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-xl font-black shadow-lg hover:bg-black transition-all uppercase text-xs">Lançar na Fila</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-2xl font-black uppercase text-slate-400 mb-6 italic tracking-tighter">Fila de Trabalho Real-Time</h2>
          
          <div className="space-y-4">
            <AnimatePresence mode='popLayout'>
              {contratos.map((c, index) => {
                const souEu = ehOResponsavel(c.responsavel);
                const ocupadoPorOutro = c.responsavel && !souEu;

                return (
                  <motion.div 
                    key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`flex items-center justify-between p-5 rounded-2xl shadow-md transition-all border-l-[12px] 
                      ${ocupadoPorOutro ? 'bg-slate-100 opacity-60 border-slate-300' : 'bg-white border-blue-600'} 
                      ${souEu ? 'ring-4 ring-yellow-400 border-yellow-400' : ''}`}
                  >
                    <div className="flex-1">
                      <h3 className={`font-black text-lg uppercase ${ocupadoPorOutro ? 'text-slate-400' : 'text-slate-800'}`}>{c.orgao}</h3>
                      <p className="font-black text-blue-600 uppercase text-xs italic">{c.servico}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-4">
                        <span className="text-[9px] font-black bg-slate-200 text-slate-500 px-2 py-1 rounded">🕒 {c.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {c.responsavel && (
                          <span className={`text-[9px] font-black px-2 py-1 rounded shadow-sm ${souEu ? 'bg-yellow-400 text-yellow-900 animate-bounce' : 'bg-slate-300 text-slate-600'}`}>
                            👤 {souEu ? "SUA TAREFA" : `COM: ${c.responsavel}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 ml-4">
                      {c.status === 'RECEBIDO' ? (
                        <button onClick={() => iniciarDemanda(c.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-2 px-6 rounded-lg text-[10px] uppercase shadow-md">ASSUMIR</button>
                      ) : (
                        <button 
                          onClick={() => concluirDemanda(c.id, c.responsavel)} 
                          className={`py-2 px-6 rounded-lg text-[10px] font-black uppercase shadow-md transition-all 
                            ${souEu ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-300 text-slate-400 cursor-not-allowed'}`}
                        >
                          CONCLUIR
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
