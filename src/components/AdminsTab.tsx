import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, UserPlus, Trash2, Pencil, KeyRound } from 'lucide-react';
import {
  ALL_AREAS,
  AREA_LABELS,
  AreaKey,
  DEFAULT_OPERATOR_PERMISSIONS,
  PermissionsMap,
  normalizePermissions,
} from '@/lib/permissions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { CategoryAccessEditor } from '@/components/CategoryAccessEditor';
import { fetchStoreCategoryMap, fetchUserCategories, saveStoreCategories, saveUserCategories } from '@/lib/categoryAccess';

interface Admin {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string | null;
  permissions?: unknown;
  email?: string;
  store_id?: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Super administrador',
  manager: 'Gerente',
  cashier: 'Caixa',
  operator: 'Operador',
};

export const AdminsTab = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<string>('operator');
  const [newStoreIds, setNewStoreIds] = useState<string[]>([]);
  const [editStoreIds, setEditStoreIds] = useState<string[]>([]);
  const [userStores, setUserStores] = useState<Record<string, string[]>>({});
  const [newPermissions, setNewPermissions] = useState<PermissionsMap>(DEFAULT_OPERATOR_PERMISSIONS);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('operator');
  const [editPermissions, setEditPermissions] = useState<PermissionsMap>({});
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Admin | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const { stores, refreshStores } = useStore();

  const [storeCats, setStoreCats] = useState<Record<string, string[]>>({});
  const [newUserCats, setNewUserCats] = useState<string[]>([]);
  const [editUserCats, setEditUserCats] = useState<string[]>([]);

  useEffect(() => {
    loadAdmins();
    loadEmails();
    fetchStoreCategoryMap().then(setStoreCats);
  }, []);

  const saveCategoryAccess = async (userId: string, storeIds: string[], userCats: string[]) => {
    for (const sid of storeIds) await saveStoreCategories(sid, storeCats[sid] || []);
    await saveUserCategories(userId, userCats);
  };

  const getAccessToken = async () =>
    session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token;

  const loadEmails = async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { action: 'list_emails' },
      });
      if (error || data?.error) return;
      setEmails(data?.emails || {});
    } catch (e) {
      console.error('Error loading emails:', e);
    }
  };


  const syncUserStores = async (userId: string, ids: string[]) => {
    const { error: delErr } = await (supabase as any).from('user_stores').delete().eq('user_id', userId);
    if (delErr) throw delErr;
    if (ids.length) {
      const { error: insErr } = await (supabase as any)
        .from('user_stores')
        .insert(ids.map((store_id) => ({ user_id: userId, store_id })));
      if (insErr) throw insErr;
    }
  };

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: links }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: true }),
        (supabase as any).from('user_stores').select('user_id, store_id'),
      ]);

      if (error) throw error;
      setAdmins(data || []);
      const map: Record<string, string[]> = {};
      for (const l of (links as any[]) || []) (map[l.user_id] ||= []).push(l.store_id);
      setUserStores(map);
    } catch (error) {
      console.error('Error loading admins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast({ title: 'Preencha email e senha', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newRole !== 'admin' && newStoreIds.length === 0) {
      toast({ title: 'Selecione pelo menos uma loja', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const accessToken = session?.access_token ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!accessToken) {
        throw new Error('Sessão expirada. Saia e entre novamente para cadastrar usuários.');
      }

      // Convert AreaKey (kebab) to snake_case for DB storage
      const permsForDb: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(newPermissions)) {
        permsForDb[k.replace(/-/g, '_')] = Boolean(v);
      }
      const finalIds = newRole === 'admin' ? [] : newStoreIds;
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          email: newEmail,
          password: newPassword,
          full_name: newName || 'Usuário',
          role: newRole,
          store_id: finalIds[0] || null,
          permissions: permsForDb,
        },
      });

      if (error) {
        let message = error.message || 'Falha ao criar usuário';
        const context = (error as any).context;
        if (context?.json) {
          const details = await context.json().catch(() => null);
          message = details?.error || details?.message || message;
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.user_id) {
        await syncUserStores(data.user_id, finalIds);
        await saveCategoryAccess(data.user_id, finalIds, newRole === 'admin' ? [] : newUserCats);
      }
      setNewUserCats([]);

      toast({
        title: 'Usuário criado!',
        description: `${newEmail} já pode fazer login.`,
      });

      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('operator');
      setNewStoreIds([]);
      setNewPermissions(DEFAULT_OPERATOR_PERMISSIONS);
      
      setTimeout(() => loadAdmins(), 1000);
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (admin: Admin) => {
    setEditing(admin);
    setEditName(admin.full_name || '');
    setEditStoreIds(userStores[admin.user_id] || []);
    setEditUserCats([]);
    fetchUserCategories(admin.user_id).then(setEditUserCats);
    fetchStoreCategoryMap().then(setStoreCats);
    setEditRole(admin.role || 'operator');
    setEditPermissions(normalizePermissions(admin.permissions));
    setEditEmail(emails[admin.user_id] || '');
    setEditPassword('');
    setEditPasswordConfirm('');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (editRole !== 'admin' && editStoreIds.length === 0) {
      toast({ title: 'Selecione pelo menos uma loja', variant: 'destructive' });
      return;
    }

    const currentEmail = emails[editing.user_id] || '';
    const newEmailValue = editEmail.trim().toLowerCase();
    const emailChanged = !!newEmailValue && newEmailValue !== currentEmail.toLowerCase();

    if (editPassword || editPasswordConfirm) {
      if (editPassword.length < 6) {
        toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
        return;
      }
      if (editPassword !== editPasswordConfirm) {
        toast({ title: 'As senhas não coincidem', variant: 'destructive' });
        return;
      }
    }

    setSavingEdit(true);
    try {
      const permsForDb: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(editPermissions)) {
        permsForDb[k.replace(/-/g, '_')] = Boolean(v);
      }
      const finalIds = editRole === 'admin' ? [] : editStoreIds;
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName, role: editRole, permissions: permsForDb as any, store_id: finalIds[0] || null })
        .eq('id', editing.id);
      if (error) throw error;
      await syncUserStores(editing.user_id, finalIds);
      await saveCategoryAccess(editing.user_id, finalIds, editRole === 'admin' ? [] : editUserCats);

      if (emailChanged || editPassword) {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error('Sessão expirada. Saia e entre novamente para alterar dados de acesso.');
        }
        const { data, error: fnError } = await supabase.functions.invoke('admin-update-user', {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            user_id: editing.user_id,
            ...(emailChanged ? { email: newEmailValue } : {}),
            ...(editPassword ? { password: editPassword } : {}),
          },
        });
        if (fnError) {
          let message = fnError.message || 'Falha ao atualizar dados de acesso';
          const context = (fnError as any).context;
          if (context?.json) {
            const details = await context.json().catch(() => null);
            message = details?.error || details?.message || message;
          }
          throw new Error(message);
        }
        if (data?.error) throw new Error(data.error);
      }

      toast({ title: 'Usuário atualizado!' });
      setEditing(null);
      setEditPassword('');
      setEditPasswordConfirm('');
      loadAdmins();
      loadEmails();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setRemovingId(deleting.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleting.id);
      if (error) throw error;
      toast({
        title: 'Administrador removido',
        description: 'O acesso ao sistema foi revogado. A conta de login ainda existe no Supabase Auth e pode ser excluída no painel se necessário.',
      });
      setDeleting(null);
      loadAdmins();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Cadastrar Novo Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="admin-name">Nome</Label>
                <Input
                  id="admin-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <Label htmlFor="admin-email">Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="admin-password">Senha *</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="admin-role">Função</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v)}>
                  <SelectTrigger id="admin-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operador (acesso restrito)</SelectItem>
                    <SelectItem value="cashier">Caixa (somente a loja dele)</SelectItem>
                    <SelectItem value="manager">Gerente (somente a loja dele)</SelectItem>
                    <SelectItem value="admin">Super administrador (todas as lojas)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Super administradores têm acesso a todas as lojas, inclusive Configurações.
                </p>
              </div>
              {newRole !== 'admin' && (
                <StoreChecklist stores={stores} value={newStoreIds} onChange={setNewStoreIds} />
              )}
            </div>

            {newRole !== 'admin' && (
              <div className="border rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  <Label className="text-sm font-semibold">Permissões do Operador</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Marque as áreas que este usuário poderá acessar. Configurações e cadastro de usuários são exclusivos de administradores.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_AREAS.filter((a) => a !== 'settings').map((area) => (
                    <label key={area} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!newPermissions[area]}
                        onCheckedChange={(checked) =>
                          setNewPermissions((p) => ({ ...p, [area]: !!checked }))
                        }
                      />
                      {AREA_LABELS[area]}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {newRole !== 'admin' && (
              <CategoryAccessEditor
                stores={stores}
                selectedStoreIds={newStoreIds}
                storeCats={storeCats}
                onStoreCatsChange={setStoreCats}
                userCats={newUserCats}
                onUserCatsChange={setNewUserCats}
              />
            )}

            <Button type="submit" disabled={creating}>
              <UserPlus className="w-4 h-4 mr-2" />
              {creating ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Usuários Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : admins.length === 0 ? (
            <p className="text-muted-foreground">Nenhum administrador cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const isSelf = admin.user_id === user?.id;
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        {admin.full_name || 'Sem nome'}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {emails[admin.user_id] || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ROLE_LABELS[admin.role || 'operator'] || admin.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {admin.role === 'admin'
                          ? 'Todas'
                          : (userStores[admin.user_id] || [])
                              .map((id) => stores.find((s) => s.id === id)?.name)
                              .filter(Boolean)
                              .join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(admin)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isSelf || removingId === admin.id}
                            onClick={() => setDeleting(admin)}
                            title={isSelf ? 'Você não pode excluir a si mesmo' : 'Excluir'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Administrador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                <Label className="text-sm font-semibold">Dados de acesso</Label>
              </div>
              <div>
                <Label htmlFor="edit-email">E-mail de login</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-password">Nova senha</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Deixe vazio para manter"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-password-confirm">Confirmar senha</Label>
                  <Input
                    id="edit-password-confirm"
                    type="password"
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Alterar o e-mail ou a senha vale para o próximo login. Mínimo de 6 caracteres na senha.
              </p>
            </div>
            <div>
              <Label htmlFor="edit-role">Função</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Super administrador (todas as lojas)</SelectItem>
                  <SelectItem value="manager">Gerente (somente a loja dele)</SelectItem>
                  <SelectItem value="cashier">Caixa (somente a loja dele)</SelectItem>
                  <SelectItem value="operator">Operador (acesso restrito)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editRole !== 'admin' && (
              <StoreChecklist stores={stores} value={editStoreIds} onChange={setEditStoreIds} />
            )}

            {editRole !== 'admin' && (
              <div className="border rounded-md p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  <Label className="text-sm font-semibold">Permissões</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_AREAS.filter((a) => a !== 'settings').map((area) => (
                    <label key={area} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!editPermissions[area]}
                        onCheckedChange={(checked) =>
                          setEditPermissions((p) => ({ ...p, [area]: !!checked }))
                        }
                      />
                      {AREA_LABELS[area]}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {editRole !== 'admin' && (
              <CategoryAccessEditor
                stores={stores}
                selectedStoreIds={editStoreIds}
                storeCats={storeCats}
                onStoreCatsChange={setStoreCats}
                userCats={editUserCats}
                onUserCatsChange={setEditUserCats}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.full_name || 'Este administrador'} perderá o acesso ao sistema.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

function StoreChecklist({
  stores,
  value,
  onChange,
}: {
  stores: { id: string; name: string; active: boolean }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string, on: boolean) =>
    onChange(on ? Array.from(new Set([...value, id])) : value.filter((v) => v !== id));
  return (
    <div className="border rounded-md p-4 space-y-2 md:col-span-2">
      <Label>Lojas com acesso *</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {stores.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={value.includes(s.id)} onCheckedChange={(c) => toggle(s.id, c === true)} />
            {s.name}
            {!s.active && <span className="text-xs text-muted-foreground">(inativa)</span>}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Marque uma ou mais lojas. O usuário só verá dados das lojas marcadas.
      </p>
    </div>
  );
}
