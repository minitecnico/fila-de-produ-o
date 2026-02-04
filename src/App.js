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
  
  // Referência para focar o cursor automaticamente no primeiro campo
  const orgaoInputRef = useRef(null);

  // 1. BUSCAR DADOS EM TEMPO REAL
  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("created_at", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContratos(dados.filter(c => c.status !== 'CONCLUIDO')); 
    });
    return unsubscribe;
  }, []);

  // 2. FUNÇÃO DE LANÇAMENTO (COM LIMPEZA AUTOMÁTICA)
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.orgao || !formData.servico) {
      return alert("Por favor, preencha Órgão e Serviço.");
    }

    try {
      // Envia para o Firebase
      await addDoc(collection(db, "contratos"), {
        orgao: formData.orgao,
        servico: formData.servico,
        fonte: formData.fonte,
        status: 'RECEBIDO',
        created_at: serverTimestamp()
      });

      // --- AQUI ACONTECE A MÁGICA QUE VOCÊ PEDIU ---
      // Limpa os estados (isso reflete nos inputs abaixo por causa do 'value')
      setFormData({ orgao: '', servico: '', fonte: '' });

      // Devolve o foco do teclado para o campo Órgão para o próximo cadastro
      if (orgaoInputRef.current) {
        orgaoInputRef.current.focus();
      }

    } catch (error) { 
      console.error("Erro ao salvar lançamento:", error); 
    }
  };

  const alterarStatus = async (id, novoStatus) => {
    await updateDoc(doc(db, "contratos", id), { status: novoStatus });
  };

  return (
    <div className="p-4 md:p-10 bg-gray-100 min-h-screen font-sans text-gray-800">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORMULÁRIO DE ENTRADA */}
        <div className="bg-white p-6 rounded-2xl shadow-xl h-fit border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-blue-700 uppercase tracking-tight">Novo Lançamento</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Órgão / Cliente</label>
              <input 
                ref={orgaoInputRef}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-gray-700" 
                placeholder="Ex: Prefeitura Municipal" 
                onChange={e => setFormData({...formData, orgao: e.target.value})} 
                value={formData.orgao} // VINCULADO AO ESTADO (Limpagem automática)
              />
            </div>
            
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Serviço</label>
              <input 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-gray-700" 
                placeholder="Ex: Manutenção de Sistema" 
                onChange={e => setFormData({...formData, servico: e.target.value})} 
                value={formData.servico} // VINCULADO AO ESTADO (Limpagem automática)
              />
            </div>
            
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase">Fonte de Entrada</label>
              <input 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 text-gray-700" 
                placeholder="Ex: WhatsApp / Chamado" 
                onChange={e => setFormData({...formData, fonte: e.target.value})} 
                value={formData.fonte} // VINCULADO AO ESTADO (Limpagem automática)
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }} 
              type="submit"
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all uppercase"
            >
              CADASTRAR NA FILA
            </motion.button>
          </form>
        </div>

        {/* LISTA DE PRIORIDADE (FILA) */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black uppercase tracking-widest text-gray-400 italic">Fila de Produção</h2>
            <div className="bg-blue-600 text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase">
              {contratos.length} Pendentes
            </div>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence>
              {contratos.map((c, index) => (
                <motion.div 
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  className={`flex items-center justify-between p-5 rounded-2xl shadow-md bg-white border-l-8 ${c.status === 'PRODUCAO' ? 'border-yellow-400' : 'border-blue-500'}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-300">#{index + 1}</span>
                      <h3 className="font-black text-lg uppercase leading-tight tracking-tighter">{c.orgao}</h3>
                    </div>
                    <p className="font-bold text-blue-600 uppercase text-xs italic">{c.servico}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">Fonte: {c.fonte || 'Não Informada'}</p>
                  </div>

                  <div className="flex flex-col items-end gap-3 ml-4">
                    <motion.span 
                      animate={c.status === 'PRODUCAO' ? { opacity: [1, 0.4, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className={`text-[9px] font-black px-2 py-1 rounded-md uppercase ${c.status === 'RECEBIDO' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-800'}`}
                    >
                      {c.status}
                    </motion.span>

                    {c.status === 'RECEBIDO' ? (
                      <motion.button 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => alterarStatus(c.id, 'PRODUCAO')} 
                        className="bg-yellow-400 text-yellow-900 font-black py-2 px-5 rounded-lg text-[10px] uppercase shadow-sm"
                      >
                        INICIAR
                      </motion.button>
                    ) : (
                      <motion.button 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => alterarStatus(c.id, 'CONCLUIDO')} 
                        className="bg-green-500 text-white font-black py-2 px-5 rounded-lg text-[10px] uppercase shadow-sm"
                      >
                        CONCLUIR
                      </motion.button>
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