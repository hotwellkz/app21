import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db, deleteClientContracts } from '../lib/firebase';
import { ClientContextMenu } from '../components/ClientContextMenu';
import { Client, NewClient, initialClientState } from '../types/client';
import { ClientList } from '../components/clients/ClientList';
import { ClientModal } from '../components/clients/ClientModal';
import { ClientPage } from './ClientPage';
import { DeleteClientModal } from '../components/modals/DeleteClientModal';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<NewClient>(initialClientState);
  const [showClientPage, setShowClientPage] = useState(false);
  const [status, setStatus] = useState<'building' | 'deposit' | 'built' | 'all'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'clients'), orderBy('clientNumber'));
      const snapshot = await getDocs(q);
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isIconsVisible: true // По умолчанию иконки видимы
      })) as Client[];
      setClients(clientsData);
      return clientsData;
    } catch (error) {
      console.error('Error fetching clients:', error);
      alert('Ошибка при загрузке списка клиентов');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(client => {
    const yearMatch = client.year === selectedYear;
    const statusMatch = status === 'all' || client.status === status;
    return yearMatch && statusMatch;
  });

  const handleContextMenu = (e: React.MouseEvent, client: Client) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setSelectedClient(client);
    setShowContextMenu(true);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setShowClientPage(true);
  };

  const handleEdit = () => {
    if (selectedClient) {
      setEditingClient({
        ...selectedClient
      });
      setShowEditModal(true);
      setShowContextMenu(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    setShowDeleteModal(true);
    setShowContextMenu(false);
  };

  const handleDeleteWithHistory = async () => {
    if (!selectedClient) return;
    
    try {
      const batch = writeBatch(db);

      // Удаляем клиента
      batch.delete(doc(db, 'clients', selectedClient.id));

      // Находим и удаляем категории
      const [projectsQuery, clientsQuery] = [
        query(
          collection(db, 'categories'),
          where('title', '==', `${selectedClient.lastName} ${selectedClient.firstName}`),
          where('row', '==', 3)
        ),
        query(
          collection(db, 'categories'),
          where('title', '==', `${selectedClient.lastName} ${selectedClient.firstName}`),
          where('row', '==', 1)
        )
      ];
      
      const [projectsSnapshot, clientsSnapshot] = await Promise.all([
        getDocs(projectsQuery),
        getDocs(clientsQuery)
      ]);

      // Получаем ID категорий для поиска транзакций
      const categoryIds = [...projectsSnapshot.docs, ...clientsSnapshot.docs].map(doc => doc.id);

      // Удаляем категории
      [...projectsSnapshot.docs, ...clientsSnapshot.docs].forEach(doc => {
        batch.delete(doc.ref);
      });

      // Находим и удаляем все связанные транзакции
      for (const categoryId of categoryIds) {
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('categoryId', '==', categoryId)
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        transactionsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      // Удаляем договоры
      await deleteClientContracts(selectedClient.id);

      // Применяем все изменения
      await batch.commit();
      
      setClients(prevClients => prevClients.filter(c => c.id !== selectedClient.id));
      setShowDeleteModal(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error deleting client with history:', error);
      alert('Ошибка при удалении клиента');
    }
  };

  const handleDeleteIconOnly = async () => {
    if (!selectedClient) return;
    
    try {
      const batch = writeBatch(db);

      // Удаляем клиента
      batch.delete(doc(db, 'clients', selectedClient.id));

      // Находим и удаляем категории
      const [projectsQuery, clientsQuery] = [
        query(
          collection(db, 'categories'),
          where('title', '==', `${selectedClient.lastName} ${selectedClient.firstName}`),
          where('row', '==', 3)
        ),
        query(
          collection(db, 'categories'),
          where('title', '==', `${selectedClient.lastName} ${selectedClient.firstName}`),
          where('row', '==', 1)
        )
      ];
      
      const [projectsSnapshot, clientsSnapshot] = await Promise.all([
        getDocs(projectsQuery),
        getDocs(clientsQuery)
      ]);
      
      // Удаляем категории
      [...projectsSnapshot.docs, ...clientsSnapshot.docs].forEach(doc => {
        batch.delete(doc.ref);
      });

      // Удаляем договоры
      await deleteClientContracts(selectedClient.id);

      // Применяем изменения
      await batch.commit();
      
      setClients(prevClients => prevClients.filter(c => c.id !== selectedClient.id));
      setShowDeleteModal(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Ошибка при удалении клиента');
    }
  };

  const handleToggleVisibility = async (client: Client) => {
    try {
      // Обновляем состояние клиента
      const clientRef = doc(db, 'clients', client.id);
      const newVisibility = !client.isIconsVisible;
      await updateDoc(clientRef, { isIconsVisible: newVisibility });

      // Обновляем видимость категорий
      const [projectsQuery, clientsQuery] = [
        query(
          collection(db, 'categories'),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('row', '==', 3)
        ),
        query(
          collection(db, 'categories'),
          where('title', '==', `${client.lastName} ${client.firstName}`),
          where('row', '==', 1)
        )
      ];
      
      const [projectsSnapshot, clientsSnapshot] = await Promise.all([
        getDocs(projectsQuery),
        getDocs(clientsQuery)
      ]);

      const batch = writeBatch(db);
      [...projectsSnapshot.docs, ...clientsSnapshot.docs].forEach(doc => {
        batch.update(doc.ref, { isVisible: newVisibility });
      });
      await batch.commit();

      // Обновляем локальное состояние
      setClients(prevClients =>
        prevClients.map(c =>
          c.id === client.id ? { ...c, isIconsVisible: newVisibility } : c
        )
      );
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Ошибка при изменении видимости иконок');
    }
  };

  const handleClientSaved = async () => {
    const updatedClients = await fetchClients();
    setClients(updatedClients);
    setShowAddModal(false);
    setShowEditModal(false);
  };

  if (showClientPage && selectedClient) {
    return (
      <ClientPage
        client={selectedClient}
        onBack={() => setShowClientPage(false)}
        onSave={handleClientSaved}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <button onClick={() => window.history.back()} className="mr-4">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Клиенты</h1>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'building' | 'deposit' | 'built' | 'all')}
                className="rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="all">Все</option>
                <option value="building">Строим</option>
                <option value="deposit">Задаток</option>
                <option value="built">Построено</option>
              </select>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-5 h-5 mr-1" />
                Добавить клиента
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <ClientList
            clients={filteredClients}
            onContextMenu={handleContextMenu}
            onClientClick={handleClientClick}
            onToggleVisibility={handleToggleVisibility}
            status={status}
          />
        )}
      </div>

      {showContextMenu && selectedClient && (
        <ClientContextMenu
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={async (newStatus) => {
            if (!selectedClient) return;

            try {
              const clientRef = doc(db, 'clients', selectedClient.id);
              await updateDoc(clientRef, { status: newStatus });
              const updatedClients = await fetchClients();
              setClients(updatedClients);
              setShowContextMenu(false);
            } catch (error) {
              console.error('Error updating client status:', error);
              alert('Ошибка при изменении статуса клиента');
            }
          }}
          clientName={`${selectedClient.lastName} ${selectedClient.firstName}`}
          currentStatus={selectedClient.status}
        />
      )}

      {(showAddModal || showEditModal) && (
        <ClientModal
          isOpen={showAddModal || showEditModal}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
          }}
          client={showEditModal ? editingClient : initialClientState}
          isEditMode={showEditModal}
          yearOptions={yearOptions}
          onSave={handleClientSaved}
        />
      )}

      {showDeleteModal && selectedClient && (
        <DeleteClientModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onDeleteWithHistory={handleDeleteWithHistory}
          onDeleteIconOnly={handleDeleteIconOnly}
          clientName={`${selectedClient.lastName} ${selectedClient.firstName}`}
        />
      )}
    </div>
  );
};