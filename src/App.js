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

  // LISTAS DE AUTO-PREENCHIMENTO ATUALIZADAS
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

  // LÓGICA INTELIGENTE: Auto-formatar PM + Nome da Cidade
  const handleOrgaoChange = (e) => {
    let valor = e.target.value.toUpperCase();
    
    // Se o usuário começar a digitar e não tiver "PM " no início, 
    // e o texto tiver mais de 3 letras, podemos sugerir ou aplicar o prefixo.
    // Aqui, vamos apenas garantir que se ele digitar, o sistema ajude na formatação.
    setFormData({...formData, orgao: valor});
  };

  // Função para aplicar o prefixo PM caso o usuário esqueça (acionada ao sair do campo ou submeter)
  const formatarPrefixo = () => {
    if (formData.orgao && !formData.orgao.startsWith('PM ') && formData.orgao.length > 3) {
      setFormData(prev => ({...prev, orgao: `PM ${prev.orgao}`}));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Aplica a regra do PM antes de salvar caso o usuário não tenha colocado
    let nomeFinal = formData.orgao.toUpperCase();
    if (nomeFinal && !nomeFinal.startsWith('PM ')) {
      nomeFinal = `PM ${nomeFinal}`;
    }

    if (!nomeFinal || !formData.servico) return alert("Preencha Órgão e Serviço!");

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
    if (!operador) return alert("Digite seu nome no topo!");
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
        
        <div className="space-y-6">
          {/* OPERADOR */}
          <div className="bg-slate-800 p-5 rounded-2xl shadow-lg text-white border-b-4 border-blue-500">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Operador do Sistema</label>
            <input 
              className="w-full bg-slate-700 border-none rounded-lg p-3 mt-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 font-bold"
              placeholder="Ex: João Silva"
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
            />
          </div>

          {/* FORMULÁRIO INTELIGENTE */}
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
            <h2 className="text-xl font-black mb-6 text-blue-700 uppercase italic underline decoration-yellow-400">Novo Lançamento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Cidade (Auto PM)</label>
                <input 
                  ref={orgaoInputRef}
                  className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500 font-bold" 
                  placeholder="Ex: ITAJUIPE"
                  onChange={handleOrgaoChange} 
                  onBlur={formatarPrefixo} // Quando sair do campo, ele coloca o PM sozinho
                  value={formData.orgao} 
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Serviço</label>
                <input 
                  list="listaServicos"
                  className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500 font-bold" 
                  onChange={e => setFormData({...formData, servico: e.target.value})} 
                  value={formData.servico}
                  placeholder="Selecione ou digite..."
                />
                <datalist id="listaServicos">
                  {sugestoesServico.map((s, i) => <option key={i} value={s} />)}
                </datalist>
              </div>

              <div>
                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Fonte</label>
                <input 
                  list="listaFontes"
                  className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500 font-bold" 
                  onChange={e => setFormData({...formData, fonte: e.target.value})} 
                  value={formData.fonte}
                />
                <datalist id="listaFontes">
                  {sugestoesFonte.map((f, i) => <option key={i} value={f} />)}
                </datalist>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">
                Lançar Demanda
              </button>
            </form>
          </div>
        </div>

        {/* LISTA DE TRABALHO */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6 px-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-gray-400 italic">Fila de Prioridade</h2>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
              {contratos.length} AGUARDANDO
            </span>
          </div>
          
          <div className="space-y-4">
            <AnimatePresence mode='popLayout'>
              {contratos.map((c, index) => (
                <motion.div 
                  key={c.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 100 }}
                  className={`flex items-center justify-between p-5 rounded-2xl shadow-md bg-white border-l-[10px] ${c.status === 'PRODUCAO' ? 'border-yellow-400' : 'border-blue-600'}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-gray-300">#{index + 1}</span>
                      <h3 className="font-black text-lg uppercase tracking-tight text-slate-700">{c.orgao}</h3>
                    </div>
                    <p className="font-black text-blue-600 uppercase text-xs italic bg-blue-50 w-fit px-2 rounded">{c.servico}</p>
                    
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">
                        🕒 {c.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[9px] font-black bg-gray-100 text-gray-400 px-2 py-1 rounded uppercase">
                        📍 {c.fonte || 'DIRETO'}
                      </span>
                      {c.responsavel && (
                        <span className="text-[9px] font-black bg-yellow-400 text-yellow-900 px-2 py-1 rounded shadow-sm animate-pulse">
                          👤 EM EXECUÇÃO: {c.responsavel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 ml-4">
                    {c.status === 'RECEBIDO' ? (
                      <button onClick={() => iniciarDemanda(c.id)} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black py-2 px-6 rounded-lg text-[10px] uppercase shadow-md transition-all">ASSUMIR</button>
                    ) : (
                      <button onClick={() => concluirDemanda(c.id)} className="bg-green-600 hover:bg-green-700 text-white font-black py-2 px-6 rounded-lg text-[10px] uppercase shadow-md transition-all">CONCLUIR</button>
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
