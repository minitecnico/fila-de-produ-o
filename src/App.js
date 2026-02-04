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
  const [operador, setOperador] = useState(''); // Nome de quem está usando o PC
  const orgaoInputRef = useRef(null);

  // 1. ESCUTAR O BANCO EM TEMPO REAL
  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("created_at", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(dados.filter(c => c.status !== 'CONCLUIDO')); 
    });
    return unsubscribe;
  }, []);

  // 2. LANÇAR NOVA DEMANDA
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.orgao || !formData.servico) return alert("Preencha os campos obrigatórios!");

    try {
      await addDoc(collection(db, "contratos"), {
        orgao: formData.orgao.toUpperCase(),
        servico: formData.servico,
        fonte: formData.fonte,
        status: 'RECEBIDO',
        responsavel: '', // Inicia sem ninguém
        created_at: serverTimestamp()
      });

      // Limpa os campos e volta o foco
      setFormData({ orgao: '', servico: '', fonte: '' });
      orgaoInputRef.current?.focus();

    } catch (error) { 
      console.error("Erro ao salvar:", error); 
    }
  };

  // 3. ASSUMIR DEMANDA (MARCAR QUEM VAI FAZER)
  const iniciarDemanda = async (id) => {
    if (!operador) {
      alert("Por favor, digite seu nome no campo 'OPERADOR' antes de assumir!");
      return;
    }
    
    await updateDoc(doc(db, "contratos", id), { 
      status: 'PRODUCAO',
      responsavel: operador.toUpperCase() 
    });
  };

  const concluirDemanda = async (id) => {
    await updateDoc(doc(db, "contratos", id), { status: 'CONCLUIDO' });
  };

  return (
    <div className="p-4 md:p-10 bg-gray-100 min-h-screen font-sans text-gray-800">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: CONFIG E CADASTRO */}
        <div className="space-y-6">
          {/* PAINEL DO OPERADOR */}
          <div className="bg-slate-800 p-5 rounded-2xl shadow-lg text-white border-b-4 border-blue-500">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Operador Atual</label>
            <input 
              className="w-full bg-slate-700 border-none rounded-lg p-3 mt-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 font-bold"
              placeholder="Digite seu nome aqui..."
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
            />
          </div>

          {/* FORMULÁRIO */}
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
            <h2 className="text-xl font-black mb-6 text-blue-700 uppercase italic">Novo Lançamento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Órgão / Cliente</label>
                <input 
                  ref={orgaoInputRef}
                  className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500" 
                  onChange={e => setFormData({...formData, orgao: e.target.value})} 
                  value={formData.orgao} 
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Serviço</label>
                <input 
                  className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500" 
                  onChange={e => setFormData({...formData, servico: e.target.value})} 
                  value={formData.servico} 
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Fonte</label>
                <input 
                  className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500" 
                  onChange={e => setFormData({...formData, fonte: e.target.value})} 
                  value={formData.fonte} 
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">
                Enviar para Fila
              </button>
            </form>
          </div>
        </div>

        {/* COLUNA DIREITA: A FILA EM TEMPO REAL */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-400 italic">Fila de Prioridade</h2>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">
              {contratos.length} em aberto
            </span>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode='popLayout'>
              {contratos.map((c, index) => (
                <motion.div 
                  key={c.id} layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: 50 }}
                  className={`flex items-center justify-between p-5 rounded-2xl shadow-md bg-white border-l-[10px] ${c.status === 'PRODUCAO' ? 'border-yellow-400' : 'border-blue-500'}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-300">#{index + 1}</span>
                      <h3 className="font-black text-lg uppercase leading-tight">{c.orgao}</h3>
                    </div>
                    <p className="font-bold text-blue-600 uppercase text-xs italic">{c.servico}</p>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded">
                        🕒 {c.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {c.fonte && (
                        <span className="text-[9px] font-black bg-gray-100 text-gray-400 px-2 py-1 rounded uppercase">
                          📍 {c.fonte}
                        </span>
                      )}
                      {c.responsavel && (
                        <span className="text-[9px] font-black bg-yellow-100 text-yellow-700 px-2 py-1 rounded animate-pulse">
                          👤 RESP: {c.responsavel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 ml-4">
                    <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ${c.status === 'RECEBIDO' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.status}
                    </span>
                    {c.status === 'RECEBIDO' ? (
                      <button 
                        onClick={() => iniciarDemanda(c.id)} 
                        className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black py-2 px-6 rounded-lg text-[10px] uppercase shadow-sm transition-all"
                      >
                        Assumir
                      </button>
                    ) : (
                      <button 
                        onClick={() => concluirDemanda(c.id)} 
                        className="bg-green-500 hover:bg-green-600 text-white font-black py-2 px-6 rounded-lg text-[10px] uppercase shadow-sm transition-all"
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
