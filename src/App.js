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

  const deletarAtividade = async (id) => { if(window.confirm("Apagar permanentemente?")) await deleteDoc(doc(db, "contratos", id)); };
  const deletarUsuario = async (id) => { if(window.confirm("Remover operador?")) await deleteDoc(doc(db, "operadores", id)); };
  const renomearUsuario = async (id, antigo) => {
    const novo =
