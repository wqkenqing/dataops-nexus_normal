import React, { useState } from 'react';
import { RefreshCw, Users, UserPlus, Key, Trash2 } from 'lucide-react';
import { fetchUsers, deleteUser, updateUserPassword, SystemUser, fetchWithAuth } from '../services/api';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState<number | null>(null);

    const [newUser, setNewUser] = useState({ username: '', email: '', password: '' });
    const [resetPassword, setResetPassword] = useState('');
    const [userError, setUserError] = useState('');

    React.useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        const data = await fetchUsers();
        setUsers(data);
        setIsLoadingUsers(false);
    };

    const handleCreateUser = async () => {
        try {
            setUserError('');
            const env = (window as any)._env_ || import.meta.env;
            const clientId = env.VITE_AUTH_CLIENT_ID || '231814316654413e';
            const authApiUrl = env.VITE_AUTH_API_URL || `http://${window.location.hostname}:8081`;
            
            const response = await fetchWithAuth(`${authApiUrl}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newUser)
            });

            if (!response.ok) {
                const err = await response.text();
                setUserError(err || 'Failed to create user');
                return;
            }

            setShowAddUserModal(false);
            setNewUser({ username: '', email: '', password: '' });
            loadUsers();
        } catch (e) {
            setUserError('Network error');
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (confirm('Are you sure you want to delete this user?')) {
            const ok = await deleteUser(id);
            if (ok) {
                loadUsers();
            } else {
                alert('Failed to delete user.');
            }
        }
    };

    const handleResetPassword = async () => {
        if (!showResetPasswordModal || !resetPassword) return;

        const ok = await updateUserPassword(showResetPasswordModal, resetPassword);
        if (ok) {
            setShowResetPasswordModal(null);
            setResetPassword('');
            alert('Password updated successfully');
        } else {
            setUserError('Failed to update password');
        }
    };

    return (
        <div className="max-w-4xl animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-2xl font-bold border-b border-gray-200 pb-4 text-gray-800 flex items-center gap-2">
                    <Users size={24} className="text-purple-600" />
                    User Management
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    Manage system access, create accounts, and reset credentials.
                </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex gap-4 items-center">
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">System Users</h3>
                            <p className="text-sm text-gray-500">View and manage all registered users.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddUserModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <UserPlus size={16} />
                        Add User
                    </button>
                </div>

                {isLoadingUsers ? (
                    <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-purple-500" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 rounded-t-lg">
                                <tr>
                                    <th className="px-6 py-3 font-semibold rounded-tl-lg">ID</th>
                                    <th className="px-6 py-3 font-semibold">Username</th>
                                    <th className="px-6 py-3 font-semibold">Email</th>
                                    <th className="px-6 py-3 font-semibold">Role</th>
                                    <th className="px-6 py-3 font-semibold text-right rounded-tr-lg">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-900">#{u.id}</td>
                                        <td className="px-6 py-4">{u.username}</td>
                                        <td className="px-6 py-4 text-gray-500">{u.email}</td>
                                        <td className="px-6 py-4 text-gray-500">{u.role}</td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => setShowResetPasswordModal(u.id)} className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors" title="Reset Password"><Key size={16} /></button>
                                            <button onClick={() => handleDeleteUser(u.id)} className="text-gray-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors" title="Delete User"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-500">
                                            No users found. If you just registered a user, please ensure the backend is restarted.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAddUserModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Add New User</h3>
                        {userError && <div className="mb-4 text-sm text-rose-600 bg-rose-50 p-2 rounded">{userError}</div>}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Username</label>
                                <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
                                <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
                                <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => { setShowAddUserModal(false); setUserError(''); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={handleCreateUser} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">Create User</button>
                        </div>
                    </div>
                </div>
            )}

            {showResetPasswordModal !== null && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Reset Password</h3>
                        {userError && <div className="mb-4 text-sm text-rose-600 bg-rose-50 p-2 rounded">{userError}</div>}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">New Password</label>
                                <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => { setShowResetPasswordModal(null); setUserError(''); setResetPassword(''); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={handleResetPassword} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">Update Password</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
