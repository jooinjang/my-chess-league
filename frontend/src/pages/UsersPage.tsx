import { useEffect, useState } from 'react';
import { User, CreateUserRequest, UpdateUserRequest } from '../types';
import { userApi } from '../api';
import { UserList, UserForm } from '../components/users';
import './UsersPage.css';

type FormMode = 'none' | 'create' | 'edit';

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>('none');
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userApi.getRankings();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (data: CreateUserRequest | UpdateUserRequest) => {
    await userApi.create(data as CreateUserRequest);
    setFormMode('none');
    loadUsers();
  };

  const handleUpdateUser = async (data: CreateUserRequest | UpdateUserRequest) => {
    if (editingUser) {
      await userApi.update(editingUser.id, data as UpdateUserRequest);
      setFormMode('none');
      setEditingUser(undefined);
      loadUsers();
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormMode('edit');
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await userApi.delete(id);
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleCancel = () => {
    setFormMode('none');
    setEditingUser(undefined);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Users</h1>
        {formMode === 'none' && (
          <button className="btn-add" onClick={() => setFormMode('create')}>
            + Add User
          </button>
        )}
      </div>

      {formMode === 'create' && (
        <UserForm
          onSubmit={handleCreateUser}
          onCancel={handleCancel}
        />
      )}

      {formMode === 'edit' && editingUser && (
        <UserForm
          user={editingUser}
          onSubmit={handleUpdateUser}
          onCancel={handleCancel}
        />
      )}

      <UserList
        users={users}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
      />
    </div>
  );
}
