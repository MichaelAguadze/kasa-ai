import { useState } from "react";
import { Settings as SettingsIcon, Server, Database, Key, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslateText, useGetSupportedLanguages } from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const testTranslateSchema = z.object({
  text: z.string().min(1, "Text required"),
  sourceLanguage: z.string().min(1, "Required"),
  targetLanguage: z.string().min(1, "Required"),
});

export default function SettingsPage() {
  const { data: languages = [] } = useGetSupportedLanguages();
  const translateText = useTranslateText();
  const [testResult, setTestResult] = useState<string | null>(null);

  const form = useForm<z.infer<typeof testTranslateSchema>>({
    resolver: zodResolver(testTranslateSchema),
    defaultValues: {
      text: "Hello, this is a test transmission.",
      sourceLanguage: "en",
      targetLanguage: "es",
    },
  });

  const onSubmit = (values: z.infer<typeof testTranslateSchema>) => {
    translateText.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          setTestResult(res.translatedText);
        }
      }
    );
  };

  const integrations = [
    { name: "TWILIO_VOICE", status: "ONLINE", icon: Server, color: "text-primary" },
    { name: "GCP_TRANSLATE", status: "ONLINE", icon: Database, color: "text-primary" },
    { name: "ELEVENLABS_TTS", status: "ONLINE", icon: Zap, color: "text-primary" },
    { name: "WS_BROKER", status: "ONLINE", icon: Key, color: "text-primary" },
  ];

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="font-mono font-bold text-2xl tracking-wider text-foreground">SYS_CONFIG</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="font-mono text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              INTEGRATION_STATUS
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase">Core API Services Health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrations.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between p-3 rounded-md bg-black/20 border border-border/50">
                  <div className="flex items-center gap-3">
                    <svc.icon className={`h-4 w-4 ${svc.color}`} />
                    <span className="font-mono text-sm">{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-primary">{svc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="font-mono text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              DIAGNOSTICS: TX_TEST
            </CardTitle>
            <CardDescription className="font-mono text-xs uppercase">Verify translation engine routing</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sourceLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs text-muted-foreground">SRC_LANG</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="font-mono bg-background/50">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.code.toUpperCase()}
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
                        <FormLabel className="font-mono text-xs text-muted-foreground">TGT_LANG</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="font-mono bg-background/50">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {languages.map((lang) => (
                              <SelectItem key={lang.code} value={lang.code}>
                                {lang.code.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs text-muted-foreground">PAYLOAD</FormLabel>
                      <FormControl>
                        <Input className="font-sans bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full font-mono mt-2 border border-accent/50 text-accent hover:bg-accent/10 hover:text-accent bg-transparent"
                  disabled={translateText.isPending}
                >
                  {translateText.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "EXECUTE_TEST"}
                </Button>

                {testResult && (
                  <div className="mt-4 p-4 rounded-md border border-primary/30 bg-primary/5 font-sans">
                    <div className="text-[10px] font-mono text-primary mb-1 uppercase tracking-widest">DECODED_OUTPUT</div>
                    <div>{testResult}</div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
