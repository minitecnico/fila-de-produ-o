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

  // FUNÇÃO DE COMPARAÇÃO REFORMULADA (Mais rigorosa)
  const validarOperador = (nomeNoCard) => {
    if (!operador.trim() || !nomeNoCard) return false;
    
    const atual = operador.trim().toUpperCase();
    const dono = nomeNoCard.trim().toUpperCase();

    // Retorna verdadeiro se o nome for idêntico ou se o primeiro nome bater exatamente
    const primeiroNomeAtual = atual.split(' ')[0];
    const primeiroNomeDono = dono.split(' ')[0];

    return atual === dono || primeiroNomeAtual === primeiroNomeDono;
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
    const nomeLimpo = operador.trim().toUpperCase();
    if (!nomeLimpo) {
      alert("ERRO: Digite seu nome no campo OPERADOR antes de assumir qualquer tarefa!");
      return;
    }
    await updateDoc(doc(db, "contratos", id), { 
      status: 'PRODUCAO',
      responsavel: nomeLimpo
    });
  };

  const concluirDemanda = async (id, nomeResponsavel) => {
    // A TRAVA REAL ESTÁ AQUI:
    if (!validarOperador(nomeResponsavel)) {
      alert(`⛔ ACESSO NEGADO: Esta tarefa pertence a ${nomeResponsavel}. Você está logado como ${operador.toUpperCase()}. Cada operador só finaliza o que assumiu!`);
      return;
    }
    await updateDoc(doc(db, "contratos", id), { status: 'CONCLUIDO' });
  };

  return (
    <div className="p-4 md:p-10 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="space-y-6">
          {/* IDENTIFICAÇÃO OBRIGATÓRIA */}
          <div className={`p-5 rounded-2xl shadow-inner transition-all ${operador ? 'bg-green-600' : 'bg-red-500'} text-white`}>
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-2">Painel de Identificação</h4>
            <input 
              className="w-full bg-white/20 border-none rounded-lg p-3 text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-white font-black uppercase"
              placeholder="QUEM É VOCÊ?"
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
            />
            {!operador && <p className="text-[10px] mt-2 font-bold animate-pulse">SISTEMA BLOQUEADO: INSIRA SEU NOME</p>}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
            <h2 className="text-xl font-black mb-6 text-slate-800 uppercase italic">Novo Registro</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input ref={orgaoInputRef} className="w-full p-4 border-2 rounded-2xl bg-slate-50 font-bold" placeholder="CIDADE" onChange={e => setFormData({...formData, orgao: e.target.value})} value={formData.orgao} />
              <input list="listaServicos" className="w-full p-4 border-2 rounded-2xl bg-slate-50 font-bold" placeholder="SERVIÇO" onChange={e => setFormData({...formData, servico: e.target.value})} value={formData.servico} />
              <datalist id="listaServicos">{sugestoesServico.map((s, i) => <option key={i} value={s} />)}</datalist>
              <input list="listaFontes" className="w-full p-4 border-2 rounded-2xl bg-slate-50 font-bold" placeholder="FONTE" onChange={e => setFormData({...formData, fonte: e.target.value})} value={formData.fonte} />
              <datalist id="listaFontes">{sugestoesFonte.map((f, i) => <option key={i} value={f} />)}</datalist>
              <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black hover:bg-black transition-all uppercase">Lançar Demanda</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <header className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black uppercase text-slate-400 italic">Fila de Produção</h2>
          </header>
          
          <div className="space-y-4">
            <AnimatePresence mode='popLayout'>
              {contratos.map((c, index) => {
                const souEu = validarOperador(c.responsavel);
                const bloqueado = c.responsavel && !souEu;

                return (
                  <motion.div 
                    key={c.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                    className={`flex items-center justify-between p-6 rounded-3xl shadow-sm border-b-4 transition-all
                      ${bloqueado ? 'bg-slate-200 grayscale opacity-50 border-slate-300' : 'bg-white border-blue-500'} 
                      ${souEu ? 'border-green-500 ring-4 ring-green-100 scale-[1.02]' : ''}`}
                  >
                    <div className="flex-1">
                      <h3 className="font-black text-xl uppercase text-slate-800 tracking-tighter">{c.orgao}</h3>
                      <p className="font-bold text-blue-600 uppercase text-sm italic">{c.servico}</p>
                      
                      <div className="flex gap-2 mt-4">
                        <span className="text-[10px] font-black bg-white border px-2 py-1 rounded-lg text-slate-400 uppercase">🕒 {c.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {c.responsavel && (
                          <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase shadow-sm ${souEu ? 'bg-green-500 text-white animate-pulse' : 'bg-slate-400 text-white'}`}>
                            {souEu ? "✅ MINHA TAREFA" : `👤 RESP: ${c.responsavel}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4">
                      {c.status === 'RECEBIDO' ? (
                        <button 
                          onClick={() => iniciarDemanda(c.id)} 
                          disabled={!operador}
                          className="bg-blue-600 text-white font-black py-3 px-6 rounded-2xl text-xs uppercase hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-lg"
                        >
                          Assumir
                        </button>
                      ) : (
                        <button 
                          onClick={() => concluirDemanda(c.id, c.responsavel)} 
                          className={`py-3 px-6 rounded-2xl text-xs font-black uppercase shadow-lg transition-all 
                            ${souEu ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
                        >
                          Concluir
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
