'use client';
import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';
import { AgentFilterSheet, type FilterState } from '../components/AgentFilterSheet';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Unlock, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const SettlementsPage = () => {
    const [settlements, setSettlements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>({ status: 'All' });

    const fetchSettlements = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/referral/settlements`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setSettlements(data);
        } catch (error) {
            toast.error('Failed to fetch settlements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettlements();
    }, []);

    const handleUnfreeze = async (id: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/referral/unfreeze/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Unfrozen ${result.releasedAmount} successfully!`);
                fetchSettlements();
            } else {
                toast.error(result.message || 'Failed to unfreeze');
            }
        } catch (error) {
            toast.error('An error occurred');
        }
    };

    const filtered = settlements.filter(s => {
        const q = searchTerm.trim().toLowerCase();
        if (q && !String(s.referrerId ?? '').toLowerCase().includes(q)) return false;

        if (filters.status && filters.status !== 'All' && s.status !== filters.status) {
            return false;
        }

        if (filters.startDate || filters.endDate) {
            const generatedAt = new Date(s.createdAt);
            if (Number.isNaN(generatedAt.getTime())) return false;
            if (filters.startDate && generatedAt < filters.startDate) return false;
            if (filters.endDate && generatedAt > filters.endDate) return false;
        }

        return true;
    });

    return (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-white">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="text-xl sm:text-2xl font-bold">Weekly Settlements</CardTitle>
                        <p className="text-slate-400 text-sm">Review all weekly commission aggregations and manage freezes.</p>
                    </div>
                    <div className="flex w-full sm:w-auto items-center gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search Agent ID..."
                                className="pl-8 bg-slate-800 border-slate-700 text-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Button
                            onClick={() => setFilterOpen(true)}
                            className={`h-10 w-10 p-0 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white shrink-0 ${
                                filters.status !== 'All' || filters.startDate || filters.endDate
                                    ? 'border-purple-500/50 text-purple-400'
                                    : ''
                            }`}
                        >
                            <Sliders size={18} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-slate-800/50">
                                <TableHead className="text-slate-400">Date Generated</TableHead>
                                <TableHead className="text-slate-400">Agent ID</TableHead>
                                <TableHead className="text-slate-400">Total Amount</TableHead>
                                <TableHead className="text-slate-400">Table (Direct)</TableHead>
                                <TableHead className="text-slate-400">Sub (Frozen)</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-slate-400">Period</TableHead>
                                <TableHead className="text-slate-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10">Loading settlements...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10">{searchTerm || filters.status !== 'All' || filters.startDate || filters.endDate ? 'No settlements match these filters.' : 'No settlements found.'}</TableCell></TableRow>
                            ) : filtered.map((settlement) => (
                                <TableRow key={settlement.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell className="font-medium">{format(new Date(settlement.createdAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                                    <TableCell className="text-indigo-400 font-mono text-xs">{settlement.referrerId}</TableCell>
                                    <TableCell className="text-green-400 font-bold">{Number(settlement.totalAmount).toFixed(2)}</TableCell>
                                    <TableCell>{Number(settlement.directAmount).toFixed(2)}</TableCell>
                                    <TableCell className="text-yellow-500">{Number(settlement.subAgentAmount).toFixed(2)}</TableCell>
                                    <TableCell>
                                        {settlement.status === 'CREATED' && <Badge className="bg-orange-900/40 text-orange-400 border-orange-800"><Clock className="w-3 h-3 mr-1" /> Pending Settlement</Badge>}
                                        {settlement.status === 'AVAILABLE' && <Badge className="bg-green-900/40 text-green-400 border-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Available for Payout</Badge>}
                                        {settlement.status === 'VOIDED' && <Badge className="bg-red-900/40 text-red-400 border-red-800"><XCircle className="w-3 h-3 mr-1" /> Voided</Badge>}
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-xs">
                                        {format(new Date(settlement.periodStart), 'MMM dd')} - {format(new Date(settlement.periodEnd), 'MMM dd')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {settlement.status === 'PAID' && Number(settlement.subAgentAmount) > 0 && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="border-yellow-600 text-yellow-500 hover:bg-yellow-900/20"
                                                onClick={() => handleUnfreeze(settlement.id)}
                                            >
                                                <Unlock className="w-4 h-4 mr-1" /> Unfreeze
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AgentFilterSheet
                open={filterOpen}
                onOpenChange={setFilterOpen}
                filters={filters}
                onApply={setFilters}
                title="Settlement Filters"
                statusOptions={[
                    { label: 'All Statuses', value: 'All' },
                    { label: 'Pending Settlement', value: 'CREATED' },
                    { label: 'Available for Payout', value: 'AVAILABLE' },
                    { label: 'Paid', value: 'PAID' },
                    { label: 'Voided', value: 'VOIDED' },
                ]}
            />
        </div>
    );
};

export default SettlementsPage;
