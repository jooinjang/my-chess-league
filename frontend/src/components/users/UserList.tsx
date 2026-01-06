import { User } from '../../types';
import './UserList.css';

interface UserListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (id: number) => void;
}

export function UserList({ users, onEdit, onDelete }: UserListProps) {
  if (users.length === 0) {
    return <div className="empty-state">No users registered yet.</div>;
  }

  return (
    <div className="user-list">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Rating</th>
            <th>RD</th>
            <th>Memo</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.id}>
              <td className="rank">#{index + 1}</td>
              <td className="name">{user.name}</td>
              <td className="rating">{Math.round(user.rating)}</td>
              <td className="rd">{Math.round(user.rating_deviation)}</td>
              <td className="memo">{user.memo || '-'}</td>
              <td className="actions">
                <button
                  className="btn-edit"
                  onClick={() => onEdit(user)}
                >
                  Edit
                </button>
                <button
                  className="btn-delete"
                  onClick={() => {
                    if (confirm(`Delete user "${user.name}"?`)) {
                      onDelete(user.id);
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
