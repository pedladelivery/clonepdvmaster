import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { useStore } from "@/contexts/StoreContext";
import { StoreFilterSelect } from "@/components/StoreFilterSelect";

import { useExportFilter } from "@/components/ui/ExportBar";
const brl=(n:any)=>`R$ ${Number(n||0).toFixed(2)}`;
const dt=(s:any)=>s?new Date(s).toLocaleString("pt-BR"):"";

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: string;
  date: string;
  created_at: string;
}

interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  salesCount: number;
}

interface FinancialProps {
  onBackToMain: () => void;
}

export const Financial = ({ onBackToMain }: FinancialProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    salesCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "" as 'income' | 'expense' | '',
    amount: "",
    description: "",
    category: "",
    date: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();
  const { scopeStoreId, writeStoreId } = useStore();

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [scopeStoreId]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (scopeStoreId) q = q.eq("store_id", scopeStoreId);
      const { data, error } = await q;

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as transações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      // Buscar vendas do mês atual
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let salesQ = supabase
        .from("sales")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", firstDay.toISOString())
        .lte("created_at", lastDay.toISOString());
      if (scopeStoreId) salesQ = salesQ.eq("store_id", scopeStoreId);
      const { data: sales, error: salesError } = await salesQ;

      if (salesError) throw salesError;

      // Buscar transações do mês atual
      let incomeQ = supabase
        .from("transactions")
        .select("amount")
        .eq("type", "income")
        .gte("date", firstDay.toISOString().split('T')[0])
        .lte("date", lastDay.toISOString().split('T')[0]);
      if (scopeStoreId) incomeQ = incomeQ.eq("store_id", scopeStoreId);
      const { data: incomeData, error: incomeError } = await incomeQ;

      if (incomeError) throw incomeError;

      let expenseQ = supabase
        .from("transactions")
        .select("amount")
        .eq("type", "expense")
        .gte("date", firstDay.toISOString().split('T')[0])
        .lte("date", lastDay.toISOString().split('T')[0]);
      if (scopeStoreId) expenseQ = expenseQ.eq("store_id", scopeStoreId);
      const { data: expenseData, error: expenseError } = await expenseQ;

      if (expenseError) throw expenseError;

      const salesTotal = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
      const incomeTotal = incomeData?.reduce((sum, income) => sum + Number(income.amount), 0) || 0;
      const expenseTotal = expenseData?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;

      const totalIncome = salesTotal + incomeTotal;
      const totalExpenses = expenseTotal;
      const balance = totalIncome - totalExpenses;

      setSummary({
        totalIncome,
        totalExpenses,
        balance,
        salesCount: sales?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const handleAddTransaction = async () => {
    if (!formData.type || !formData.amount || !formData.description || !formData.category) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (amount <= 0) {
      toast({
        title: "Erro",
        description: "Valor deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .insert([{
          type: formData.type,
          amount,
          description: formData.description,
          category: formData.category,
          date: formData.date,
          store_id: writeStoreId!,
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação adicionada com sucesso",
      });

      setDialogOpen(false);
      setFormData({
        type: "",
        amount: "",
        description: "",
        category: "",
        date: new Date().toISOString().split('T')[0],
      });
      fetchTransactions();
      fetchSummary();
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a transação",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const incomeCategories = [
    "Vendas",
    "Serviços",
    "Comissões",
    "Outros Recebimentos"
  ];

  const expenseCategories = [
    "Fornecedores",
    "Aluguel",
    "Salários",
    "Energia Elétrica",
    "Internet",
    "Marketing",
    "Manutenção",
    "Impostos",
    "Outros Gastos"
  ];

  const { filtered, bar } = useExportFilter(transactions, {
    title: "Financeiro", getDate: (r) => r.date,
    columns: [
      { header: "Data", value: (r) => new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR") },
      { header: "Tipo", value: (r) => (r.type === "income" ? "Receita" : "Despesa") },
      { header: "Categoria", value: (r) => r.category },
      { header: "Descrição", value: (r) => r.description },
      { header: "Valor", value: (r) => brl(r.amount) },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      {bar}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Financeiro</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Tipo *</Label>
                <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value, category: "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type && (
                <div>
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.type === 'income' ? incomeCategories : expenseCategories).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a transação"
                />
              </div>

              <div>
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <Button onClick={handleAddTransaction} className="w-full">
                Adicionar Transação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.salesCount} vendas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.balance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={summary.balance >= 0 ? "default" : "destructive"}>
              {summary.balance >= 0 ? "Positivo" : "Negativo"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Carregando transações...</p>
          ) : (
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma transação registrada</p>
              ) : (
                filtered.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {transaction.type === 'income' ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium">{transaction.description}</span>
                        <Badge variant="outline">{transaction.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(transaction.date)}
                      </p>
                    </div>
                    <div className={`text-lg font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};