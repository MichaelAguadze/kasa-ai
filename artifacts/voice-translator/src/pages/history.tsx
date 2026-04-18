import { useState } from "react";
import { useGetCallHistory } from "@workspace/api-client-react";
import { format, formatDistance } from "date-fns";
import { History as HistoryIcon, Clock, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const { data: history = [], isLoading } = useGetCallHistory();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  const formatDuration = (seconds?: number | null) => {
    if (seconds == null) return "--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <div className="flex items-center gap-3">
        <HistoryIcon className="h-6 w-6 text-primary" />
        <h1 className="font-mono font-bold text-2xl tracking-wider text-foreground">COMM_LOGS</h1>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50 flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="font-mono text-lg">ARCHIVED TRANSMISSIONS</CardTitle>
          <CardDescription className="font-mono text-xs uppercase">Historical call records and decoded transcripts</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-xs text-muted-foreground py-3 w-[50px]"></TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground py-3">TARGET_NO</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground py-3">LANG_PAIR</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground py-3">TIMESTAMP</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground py-3">DURATION</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground py-3">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono">
                      RETRIEVING ARCHIVES...
                    </TableCell>
                  </TableRow>
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono">
                      NO RECORDS FOUND
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((record) => (
                    <Collapsible
                      key={record.callSid}
                      asChild
                      open={expandedRows.has(record.callSid)}
                      onOpenChange={() => toggleRow(record.callSid)}
                    >
                      <>
                        <TableRow className="border-border/50 cursor-pointer group hover:bg-primary/5">
                          <TableCell className="p-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20">
                                {expandedRows.has(record.callSid) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{record.toNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
                              {record.sourceLanguage.toUpperCase()} <span className="mx-1 text-muted-foreground">→</span> {record.targetLanguage.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {format(new Date(record.startedAt), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDuration(record.duration)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`font-mono text-[10px] ${
                                record.status === 'completed' ? 'border-primary/50 text-primary' : 
                                record.status === 'failed' ? 'border-destructive/50 text-destructive' : 
                                'border-accent/50 text-accent'
                              }`}
                            >
                              {record.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-black/20 border-border/50">
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-4 pl-14 border-l-2 border-primary/30 bg-primary/5 m-2 rounded-r-md">
                                <div className="flex items-center gap-2 mb-4">
                                  <MessageSquare className="h-4 w-4 text-primary" />
                                  <span className="font-mono text-xs font-bold text-primary">DECODED_TRANSCRIPT ({record.transcriptCount} PACKETS)</span>
                                </div>
                                <div className="text-sm font-mono text-muted-foreground">
                                  {/* Detailed transcript view would go here if returned by the history API, 
                                      otherwise we show a summary or fetch on expand. For now, showing packet count. */}
                                  {record.transcriptCount > 0 ? (
                                     <div className="italic opacity-50">Transcript details available via individual record query.</div>
                                  ) : (
                                    <span className="opacity-50">NO DATA PACKETS RECOVERED</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
