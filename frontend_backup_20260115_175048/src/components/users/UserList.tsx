import { User } from '../../types';
import { Link } from 'react-router-dom';
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
            <th scope="col">Rank</th>
            <th scope="col">Name</th>
            <th scope="col">Rating</th>
            <th scope="col">RD</th>
            <th scope="col">Memo</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.id}>
              <td className="rank" data-label="Rank">#{index + 1}</td>
              <td className="name" data-label="Name">
                <Link className="user-link" to={`/users/${user.id}`}>
                  {user.name}
                </Link>
              </td>
              <td className="rating" data-label="Rating">{Math.round(user.rating)}</td>
              <td className="rd" data-label="RD">{Math.round(user.rating_deviation)}</td>
              <td className="memo" data-label="Memo">{user.memo || '-'}</td>
              <td className="actions" data-label="">
                <button
                  className="btn-edit"
                  onClick={() => onEdit(user)}
                  aria-label={`Edit ${user.name}`}
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
                  aria-label={`Delete ${user.name}`}
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
