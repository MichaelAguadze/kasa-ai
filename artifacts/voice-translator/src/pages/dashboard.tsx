import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Phone, Globe, Play, Square, Activity, Volume2, VolumeX, Loader2 } from "lucide-react";
import { 
  useInitiateCall, 
  useGetSupportedLanguages, 
  useGetCallStatus,
  useEndCall,
  getGetCallStatusQueryKey
} from "@workspace/api-client-react";
import type { TranscriptEntry } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const callFormSchema = z.object({
  toNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g., +1234567890)"),
  sourceLanguage: z.string().min(1, "Required"),
  targetLanguage: z.string().min(1, "Required"),
});

export default function Dashboard() {
  const { toast } = useToast();
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [duration, setDuration] = useState(0);

  const { data: languages = [] } = useGetSupportedLanguages();
  
  const initiateCall = useInitiateCall();
  const endCall = useEndCall();

  const { data: callStatus } = useGetCallStatus(activeCallSid || "", {
    query: {
      enabled: !!activeCallSid,
      queryKey: getGetCallStatusQueryKey(activeCallSid || ""),
      refetchInterval: activeCallSid && !wsRef.current ? 2000 : false, // Fallback polling
    }
  });

  const form = useForm<z.infer<typeof callFormSchema>>({
    resolver: zodResolver(callFormSchema),
    defaultValues: {
      toNumber: "",
      sourceLanguage: "en",
      targetLanguage: "es",
    },
  });

  useEffect(() => {
    if (callStatus?.status === 'completed' || callStatus?.status === 'failed') {
      setActiveCallSid(null);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
    
    if (callStatus?.transcript) {
      // Merge transcripts, avoiding duplicates
      setTranscript(prev => {
        const newEntries = callStatus.transcript || [];
        const prevIds = new Set(prev.map(e => e.id));
        const uniqueNew = newEntries.filter(e => !prevIds.has(e.id));
        return [...prev, ...uniqueNew];
      });
    }
  }, [callStatus]);

  useEffect(() => {
    // Auto-scroll transcript
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCallSid) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCallSid]);

  const setupWebSocket = (callSid: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/call/${callSid}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript') {
          setTranscript(prev => [...prev, data.entry]);
        } else if (data.type === 'status') {
          if (data.status === 'completed' || data.status === 'failed') {
            setActiveCallSid(null);
            ws.close();
          }
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
  };

  const onSubmit = (values: z.infer<typeof callFormSchema>) => {
    initiateCall.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          setActiveCallSid(res.callSid);
          setTranscript([]);
          setDuration(0);
          setupWebSocket(res.callSid);
          toast({
            title: "LINK ESTABLISHED",
            description: `Connecting to ${values.toNumber}`,
          });
        },
        onError: (err) => {
          toast({
            title: "CONNECTION FAILED",
            description: err?.message || "Unknown error",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleEndCall = () => {
    if (activeCallSid) {
      endCall.mutate(
        { callSid: activeCallSid },
        {
          onSuccess: () => {
            setActiveCallSid(null);
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            toast({ title: "LINK TERMINATED", description: "Call ended." });
          }
        }
      );
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex p-6 gap-6 overflow-hidden">
      {/* Control Panel */}
      <div className="w-1/3 flex flex-col gap-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="font-mono text-primary flex items-center gap-2">
              <Globe className="h-5 w-5" />
              NEW TX_LINK
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase tracking-wider">
              Establish translated communication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="toNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs text-muted-foreground">TARGET NUMBER</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="+1234567890" 
                            className="pl-9 font-mono bg-background/50" 
                            disabled={!!activeCallSid || initiateCall.isPending}
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="font-mono text-[10px]" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sourceLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs text-muted-foreground">LOCAL LANG</FormLabel>
                        <Select 
                          disabled={!!activeCallSid || initiateCall.isPending} 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="font-mono bg-background/50">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.nativeName} ({lang.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs text-muted-foreground">REMOTE LANG</FormLabel>
                        <Select 
                          disabled={!!activeCallSid || initiateCall.isPending} 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="font-mono bg-background/50">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.nativeName} ({lang.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full font-mono mt-4 border border-primary/50 hover:bg-primary/20 transition-all"
                  disabled={!!activeCallSid || initiateCall.isPending}
                >
                  {initiateCall.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> INITIATING...</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" /> START LINK</>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {activeCallSid && (
          <Card className="bg-card/50 backdrop-blur border-primary/30 glow-teal">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="font-mono text-primary flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  LINK_ACTIVE
                </CardTitle>
                <div className="font-mono text-xl tabular-nums text-foreground">
                  {formatDuration(duration)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground">SID:</span>
                  <span className="truncate max-w-[200px]">{activeCallSid}</span>
                </div>
                <Button 
                  variant="destructive" 
                  className="w-full font-mono border border-destructive/50"
                  onClick={handleEndCall}
                  disabled={endCall.isPending}
                >
                  {endCall.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Square className="mr-2 h-4 w-4 fill-current" /> TERMINATE</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live Transcript Panel */}
      <div className="flex-1 flex flex-col border border-border/50 rounded-lg overflow-hidden bg-black/40 backdrop-blur-md relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 z-10"></div>
        
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/30">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-mono font-bold tracking-widest text-primary/80">STREAM_DECODE</h2>
          </div>
          {activeCallSid && (
            <div className="px-3 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-mono flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              LIVE
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 p-6">
          {!activeCallSid && transcript.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground font-mono opacity-50">
              <VolumeX className="h-12 w-12 mb-4" />
              <p>WAITING FOR SIGNAL...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {transcript.map((entry) => {
                const isLocal = entry.speaker === 'caller';
                return (
                  <div key={entry.id} className={cn("flex flex-col max-w-[85%]", isLocal ? "items-start" : "items-end ml-auto")}>
                    <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      {isLocal ? <Volume2 className="h-3 w-3 text-primary" /> : <Volume2 className="h-3 w-3 text-accent" />}
                      <span>{isLocal ? 'LOCAL_TX' : 'REMOTE_RX'}</span>
                      <span className="opacity-50">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className={cn(
                      "p-3 rounded-md border backdrop-blur-sm",
                      isLocal 
                        ? "bg-primary/5 border-primary/20 text-foreground" 
                        : "bg-accent/5 border-accent/20 text-foreground"
                    )}>
                      <div className="text-sm mb-2 opacity-60 font-sans">{entry.originalText}</div>
                      <div className="text-base font-medium font-sans">{entry.translatedText}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
