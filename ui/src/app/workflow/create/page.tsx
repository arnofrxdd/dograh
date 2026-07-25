'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { 
    createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost,
    getModelConfigurationV2DefaultsApiV1OrganizationsModelConfigurationsV2DefaultsGet,
    getModelConfigurationPricingApiV1OrganizationsModelConfigurationsV2PricingGet,
    updateWorkflowApiV1WorkflowWorkflowIdPut,
    publishWorkflowApiV1WorkflowWorkflowIdPublishPost
} from '@/client/sdk.gen';
import type { 
    OrganizationAiModelConfigurationV2, 
    ModelConfigurationPricingResponse 
} from '@/client/types.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { LANGUAGE_DISPLAY_NAMES } from '@/constants/languages';
import { AIModelConfigurationV2Editor, type ModelConfigurationDefaultsV2 } from '@/components/AIModelConfigurationV2Editor';
import { 
    Check, Info, ArrowRight, ArrowLeft, Loader2, Sparkles 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const STEPS = [
    { id: 1, title: 'Identity' },
    { id: 2, title: 'Behavior' },
    { id: 3, title: 'Voice & Language' },
    { id: 4, title: 'Call Flow' },
    { id: 5, title: 'Goals' },
    { id: 6, title: 'Tools' },
    { id: 7, title: 'Guardrails' },
    { id: 8, title: 'Context' },
    { id: 9, title: 'Domain Hints' },
];

export default function CreateWorkflowWizard() {
    const router = useRouter();
    const { user, getAccessToken } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI Model Data
    const [defaults, setDefaults] = useState<ModelConfigurationDefaultsV2 | null>(null);
    const [pricing, setPricing] = useState<ModelConfigurationPricingResponse | null>(null);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [modelConfig, setModelConfig] = useState<OrganizationAiModelConfigurationV2 | null>(null);
    const [showModelOverride, setShowModelOverride] = useState(false);

    // Fetch Editor defaults
    useEffect(() => {
        let mounted = true;
        async function fetchModelData() {
            if (!user) return;
            setIsModelLoading(true);
            try {
                const token = await getAccessToken();
                const opts = { headers: { Authorization: `Bearer ${token}` } };
                const [defRes, priceRes] = await Promise.all([
                    getModelConfigurationV2DefaultsApiV1OrganizationsModelConfigurationsV2DefaultsGet(opts),
                    getModelConfigurationPricingApiV1OrganizationsModelConfigurationsV2PricingGet(opts)
                ]);
                if (mounted) {
                    if (defRes.data) setDefaults(defRes.data as unknown as ModelConfigurationDefaultsV2);
                    if (priceRes.data) setPricing(priceRes.data);
                }
            } catch (err) {
                logger.error("Failed to fetch model defaults", err);
            } finally {
                if (mounted) setIsModelLoading(false);
            }
        }
        fetchModelData();
        return () => { mounted = false; };
    }, [user, getAccessToken]);

    // Check if realtime is selected in model override
    const isRealtime = showModelOverride && (
        (modelConfig as any)?.mode === "realtime" || 
        (modelConfig as any)?.is_realtime === true
    );

    // --- FORM STATE ---
    // EXISTING REQUIRED
    const [callType, setCallType] = useState<'inbound' | 'outbound'>('inbound');
    const [useCase, setUseCase] = useState('');
    const [activityDescription, setActivityDescription] = useState('');

    // Step 1: Identity
    const [name, setName] = useState('');
    const [agentPersona, setAgentPersona] = useState('');
    const [greetingMessage, setGreetingMessage] = useState('');

    // Step 2: Behavior
    const [tone, setTone] = useState<string>('professional');
    const [verbosity, setVerbosity] = useState<string>('balanced');
    const [formality, setFormality] = useState<string>('semi-formal');
    const [fillerWords, setFillerWords] = useState(false);
    const [empathyResponses, setEmpathyResponses] = useState(true);

    // Step 3: Voice & Language
    const [language, setLanguage] = useState<string>('en');
    const [ambientNoise, setAmbientNoise] = useState(false);

    // Step 4: Call Flow
    const [maxCallDuration, setMaxCallDuration] = useState<number | ''>(600);
    const [maxUserIdleTimeout, setMaxUserIdleTimeout] = useState<number | ''>(15);
    const [turnStartStrategy, setTurnStartStrategy] = useState<string>('default');
    const [turnStartMinWords, setTurnStartMinWords] = useState<number | ''>(1);
    const [provisionalVadPauseSecs, setProvisionalVadPauseSecs] = useState<number | ''>(1.0);
    const [turnStopStrategy, setTurnStopStrategy] = useState<string>('transcription');
    const [contextCompaction, setContextCompaction] = useState(false);

    // Force context_compaction off if realtime
    useEffect(() => {
        if (isRealtime) {
            setContextCompaction(false);
        }
    }, [isRealtime]);

    // Step 5: Goals
    const [primaryGoal, setPrimaryGoal] = useState('');
    const [successCriteria, setSuccessCriteria] = useState('');
    const [failureCriteria, setFailureCriteria] = useState('');
    const [objectionHandling, setObjectionHandling] = useState(true);
    const [escalationPath, setEscalationPath] = useState<string>('none');
    const [escalationNumber, setEscalationNumber] = useState('');
    const [endCallCondition, setEndCallCondition] = useState<string>('all');

    // Step 6: Tools
    const [enableTransferCall, setEnableTransferCall] = useState(false);
    const [enableEndCallTool, setEnableEndCallTool] = useState(true);
    const [enableDtmfInput, setEnableDtmfInput] = useState(false);
    const [dataCollectionFields, setDataCollectionFields] = useState<string>(''); // CSV to array

    // Step 7: Guardrails
    const [offTopicHandling, setOffTopicHandling] = useState<string>('redirect');
    const [prohibitedTopics, setProhibitedTopics] = useState<string>(''); // CSV to array
    const [piiPolicy, setPiiPolicy] = useState<string>('allowed');
    const [profanityFilter, setProfanityFilter] = useState(false);
    const [complianceScript, setComplianceScript] = useState('');

    // Step 8: Context Variables
    const [contextVariables, setContextVariables] = useState<string>(''); // JSON string

    // Step 9: Domain Hints
    const [industry, setIndustry] = useState('');
    const [targetAudience, setTargetAudience] = useState<string>('consumer');
    const [avgCallLength, setAvgCallLength] = useState<string>('medium');

    const handleNext = () => {
        // Validation for step 1
        if (currentStep === 1) {
            if (!callType || !useCase || !activityDescription) {
                toast.error("Call Type, Use Case, and Activity Description are required");
                return;
            }
        }
        if (currentStep === 5) {
            if (escalationPath === 'transfer' && escalationNumber) {
                const e164Regex = /^\+[1-9]\d{7,14}$/;
                if (!e164Regex.test(escalationNumber.trim())) {
                    toast.error("Transfer number must be E.164 format (e.g. +12125551234)");
                    return;
                }
            }
        }
        if (currentStep < 9) setCurrentStep(c => c + 1);
    };

    const handlePrev = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1);
    };

    const handleSubmit = async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);

        try {
            const token = await getAccessToken();
            
            // Parse CSV strings
            const dataFields = dataCollectionFields.split(',').map(s => s.trim()).filter(Boolean);
            const prohibited = prohibitedTopics.split(',').map(s => s.trim()).filter(Boolean);
            
            // Parse JSON for context variables
            let ctxVars = {};
            if (contextVariables.trim()) {
                try {
                    ctxVars = JSON.parse(contextVariables);
                    // Regex validation
                    const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
                    for (const key of Object.keys(ctxVars)) {
                        if (!pattern.test(key)) {
                            throw new Error(`Invalid context variable key: ${key}`);
                        }
                    }
                } catch (e: any) {
                    toast.error(`Context variables error: ${e.message}`);
                    setIsLoading(false);
                    return;
                }
            }

            const body: any = {
                call_type: callType,
                use_case: useCase,
                activity_description: activityDescription,
                name: name || undefined,
                agent_persona: agentPersona || undefined,
                greeting_message: greetingMessage || undefined,
                tone: tone || undefined,
                verbosity: verbosity || undefined,
                formality: formality || undefined,
                filler_words_enabled: fillerWords,
                empathy_responses_enabled: empathyResponses,
                language: language || undefined,
                ambient_noise: ambientNoise,
                max_call_duration: typeof maxCallDuration === 'number' ? maxCallDuration : undefined,
                max_user_idle_timeout: typeof maxUserIdleTimeout === 'number' ? maxUserIdleTimeout : undefined,
                turn_start_strategy: turnStartStrategy,
                turn_start_min_words: typeof turnStartMinWords === 'number' ? turnStartMinWords : undefined,
                provisional_vad_pause_secs: typeof provisionalVadPauseSecs === 'number' ? provisionalVadPauseSecs : undefined,
                turn_stop_strategy: turnStopStrategy,
                context_compaction_enabled: contextCompaction,
                primary_goal: primaryGoal || undefined,
                success_criteria: successCriteria || undefined,
                failure_criteria: failureCriteria || undefined,
                objection_handling: objectionHandling,
                escalation_path: escalationPath,
                escalation_transfer_number: escalationNumber.trim() || undefined,
                end_call_condition: endCallCondition,
                enable_transfer_call: enableTransferCall,
                enable_end_call_tool: enableEndCallTool,
                enable_dtmf_input: enableDtmfInput,
                data_collection_fields: dataFields,
                off_topic_handling: offTopicHandling,
                prohibited_topics: prohibited,
                pii_collection_policy: piiPolicy,
                profanity_filter: profanityFilter,
                compliance_script: complianceScript || undefined,
                context_variables: ctxVars,
                industry: industry || undefined,
                target_audience: targetAudience || undefined,
                avg_call_length: avgCallLength || undefined,
            };

            const response = await createWorkflowFromTemplateApiV1WorkflowCreateTemplatePost({
                body,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data?.id) {
                const newId = response.data.id;
                
                // Post-creation write for model override
                if (showModelOverride && modelConfig) {
                    await updateWorkflowApiV1WorkflowWorkflowIdPut({
                        path: { workflow_id: newId },
                        body: {
                            workflow_configurations: {
                                model_configuration_v2_override: modelConfig
                            },
                            name: null as any,
                            workflow_definition: null as any,
                            template_context_variables: null as any
                        },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    await publishWorkflowApiV1WorkflowWorkflowIdPublishPost({
                        path: { workflow_id: newId },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }

                toast.success("Workflow created successfully!");
                router.push(`/workflow/${newId}?onboarding=web_call`);
            }
        } catch (err: any) {
            logger.error(`Error creating workflow: ${err}`);
            const msg = err.response?.data?.detail || err.message || "Failed to create workflow";
            setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
            
            const status = err.response?.status;
            if (status === 422) {
                toast.error("Agent generation failed — try with more specific details");
            } else if (err.name === 'TimeoutError' || err.code === 'ECONNABORTED' || status === 504) {
                toast.error("Taking longer than usual — please try again");
            } else {
                toast.error("Something went wrong — check your network and retry");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col py-12 px-6 items-center">
            <div className="w-full max-w-4xl space-y-8">
                
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Create Voice Agent</h1>
                    <p className="text-muted-foreground">Configure your AI agent with advanced settings in 9 easy steps.</p>
                </div>

                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-8 gap-2 overflow-x-auto pb-4">
                    {STEPS.map((step) => (
                        <div key={step.id} className="flex flex-col items-center flex-1 min-w-[80px]">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mb-2 transition-colors
                                ${currentStep === step.id ? 'bg-primary text-primary-foreground border-2 border-primary' : 
                                  currentStep > step.id ? 'bg-muted text-muted-foreground' : 'bg-transparent border-2 border-muted-foreground text-muted-foreground'}`}>
                                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                            </div>
                            <span className={`text-[10px] text-center uppercase tracking-wider font-semibold 
                                ${currentStep === step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                                {step.title}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="bg-card border rounded-xl p-8 shadow-sm min-h-[500px]">
                    {/* Step 1: Identity */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">1. Identity & Core (Required)</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Call Type *</Label>
                                    <Select value={callType} onValueChange={(v) => setCallType(v as any)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="inbound">Inbound</SelectItem>
                                            <SelectItem value="outbound">Outbound</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Use Case *</Label>
                                    <Input value={useCase} onChange={e => setUseCase(e.target.value)} placeholder="e.g. Lead Qual" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Activity Description *</Label>
                                    <Textarea value={activityDescription} onChange={e => setActivityDescription(e.target.value)} placeholder="Brief description of agent tasks..." className="min-h-[100px]" />
                                </div>
                                <div className="space-y-2 md:col-span-2 border-t pt-4">
                                    <h3 className="text-sm font-semibold mb-2">Optional Identity Settings</h3>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Agent Name</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Agent Persona</Label>
                                    <Input value={agentPersona} onChange={e => setAgentPersona(e.target.value)} placeholder="e.g. Helpful assistant" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Greeting Message</Label>
                                    <Textarea value={greetingMessage} onChange={e => setGreetingMessage(e.target.value)} placeholder="Hi, this is Alex..." />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Behavior */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">2. Behavior</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Tone</Label>
                                    <Select value={tone} onValueChange={setTone}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="professional">Professional</SelectItem>
                                            <SelectItem value="friendly">Friendly</SelectItem>
                                            <SelectItem value="empathetic">Empathetic</SelectItem>
                                            <SelectItem value="authoritative">Authoritative</SelectItem>
                                            <SelectItem value="casual">Casual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Verbosity</Label>
                                    <Select value={verbosity} onValueChange={setVerbosity}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="concise">Concise</SelectItem>
                                            <SelectItem value="balanced">Balanced</SelectItem>
                                            <SelectItem value="detailed">Detailed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Formality</Label>
                                    <Select value={formality} onValueChange={setFormality}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="formal">Formal</SelectItem>
                                            <SelectItem value="semi-formal">Semi-formal</SelectItem>
                                            <SelectItem value="informal">Informal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between border rounded-lg p-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-semibold">Filler Words</Label>
                                            <p className="text-xs text-muted-foreground">Inject um, ah for realism</p>
                                        </div>
                                        <Switch checked={fillerWords} onCheckedChange={setFillerWords} />
                                    </div>
                                    <div className="flex items-center justify-between border rounded-lg p-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-semibold">Empathy Responses</Label>
                                            <p className="text-xs text-muted-foreground">React to emotion dynamically</p>
                                        </div>
                                        <Switch checked={empathyResponses} onCheckedChange={setEmpathyResponses} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Voice & Language */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">3. Voice & Language</h2>
                            
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider">Language</Label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(LANGUAGE_DISPLAY_NAMES).map(([code, name]) => (
                                            <SelectItem key={code} value={code}>{name} ({code})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {language !== 'en' && language !== 'en-US' && (
                                    <p className="text-[10px] text-orange-500 font-medium mt-1">
                                        * Ensure your Organization's TTS provider (or Model Override) supports this language, otherwise voice synthesis may fail or use a heavy accent.
                                    </p>
                                )}
                            </div>

                            <div className="flex items-start justify-between border rounded-lg p-4 bg-muted/20">
                                <div className="space-y-1">
                                    <Label className="text-sm font-semibold">Ambient Noise</Label>
                                    <p className="text-xs text-muted-foreground">Play background noise during calls to improve realism.</p>
                                    {ambientNoise && (
                                        <p className="text-[10px] text-blue-500 font-medium mt-1">
                                            * You can upload the audio file in Workflow Settings after creation.
                                        </p>
                                    )}
                                </div>
                                <Switch checked={ambientNoise} onCheckedChange={setAmbientNoise} />
                            </div>

                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Model Override</Label>
                                        <p className="text-xs text-muted-foreground">Override the default LLM, TTS, STT models.</p>
                                    </div>
                                    <Switch checked={showModelOverride} onCheckedChange={setShowModelOverride} />
                                </div>
                                
                                {showModelOverride && (
                                    <div className="border rounded-lg p-4 bg-card">
                                        {isModelLoading ? (
                                            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
                                        ) : defaults && pricing ? (
                                            <AIModelConfigurationV2Editor 
                                                defaults={defaults}
                                                pricing={pricing}
                                                configuration={modelConfig}
                                                onSave={async (conf: any) => setModelConfig(conf)}
                                                submitLabel="Apply to Draft"
                                            />
                                        ) : (
                                            <p className="text-sm text-destructive">Failed to load editor</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-4 italic">
                                            Note: Since this workflow doesn't exist yet, this config will be held in state but will not be saved on creation. You will need to save it in workflow settings later.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Call Flow */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">4. Call Flow Configuration</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Max Call Duration (seconds)</Label>
                                    <Input type="number" value={maxCallDuration} onChange={e => setMaxCallDuration(parseInt(e.target.value) || '')} min={1} max={1200} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Max User Idle Timeout (seconds)</Label>
                                    <Input type="number" value={maxUserIdleTimeout} onChange={e => setMaxUserIdleTimeout(parseFloat(e.target.value) || '')} min={5} max={30} step={0.5} />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Turn Start Strategy</Label>
                                    <Select value={turnStartStrategy} onValueChange={setTurnStartStrategy}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Default</SelectItem>
                                            <SelectItem value="min_words">Min Words</SelectItem>
                                            <SelectItem value="provisional_vad">Provisional VAD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Turn Stop Strategy</Label>
                                    <Select value={turnStopStrategy} onValueChange={setTurnStopStrategy}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="transcription">Transcription</SelectItem>
                                            <SelectItem value="turn_analyzer">Turn Analyzer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {turnStartStrategy === 'min_words' && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider">Turn Start Min Words</Label>
                                        <Input type="number" value={turnStartMinWords} onChange={e => setTurnStartMinWords(parseInt(e.target.value) || '')} min={1} max={10} />
                                    </div>
                                )}
                                {turnStartStrategy === 'provisional_vad' && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider">Provisional VAD Pause (secs)</Label>
                                        <Input type="number" value={provisionalVadPauseSecs} onChange={e => setProvisionalVadPauseSecs(parseFloat(e.target.value) || '')} min={0.5} max={3.0} step={0.1} />
                                    </div>
                                )}

                                <div className="md:col-span-2 pt-2 border-t">
                                    <div className="flex items-center justify-between border rounded-lg p-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-sm font-semibold">Context Compaction</Label>
                                                {isRealtime && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger><Info className="h-4 w-4 text-amber-500" /></TooltipTrigger>
                                                            <TooltipContent>Disabled because Realtime model is selected in override.</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">Compress conversation history to save tokens.</p>
                                        </div>
                                        <Switch checked={contextCompaction} onCheckedChange={setContextCompaction} disabled={isRealtime} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Goals */}
                    {currentStep === 5 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">5. Goals & Rules</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Primary Goal</Label>
                                    <Input value={primaryGoal} onChange={e => setPrimaryGoal(e.target.value)} placeholder="e.g. Schedule an appointment" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Success Criteria</Label>
                                    <Textarea value={successCriteria} onChange={e => setSuccessCriteria(e.target.value)} placeholder="When is the call successful?" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Failure Criteria</Label>
                                    <Textarea value={failureCriteria} onChange={e => setFailureCriteria(e.target.value)} placeholder="When should we consider it failed?" />
                                </div>
                                
                                <div className="flex flex-col justify-center border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-sm font-semibold">Objection Handling</Label>
                                        <Switch checked={objectionHandling} onCheckedChange={setObjectionHandling} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Allow agent to argue back against rejections.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">End Call Condition</Label>
                                    <Select value={endCallCondition} onValueChange={setEndCallCondition}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="goal_met">Goal Met</SelectItem>
                                            <SelectItem value="user_request">User Request</SelectItem>
                                            <SelectItem value="timeout">Timeout</SelectItem>
                                            <SelectItem value="all">All of the Above</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Escalation Path</Label>
                                    <Select value={escalationPath} onValueChange={setEscalationPath}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="transfer">Transfer</SelectItem>
                                            <SelectItem value="callback">Callback</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {escalationPath === 'transfer' && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider">Transfer Number</Label>
                                        <Input value={escalationNumber} onChange={e => setEscalationNumber(e.target.value)} placeholder="+1234567890" />
                                    </div>
                                )}
                                {escalationPath === 'callback' && (
                                    <div className="space-y-2 md:col-span-2">
                                        <p className="text-[10px] text-blue-500 font-medium mt-1">
                                            * Requires callback configuration in org settings
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 6: Tools */}
                    {currentStep === 6 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">6. Tools & Extraction</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border rounded-lg p-4">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold">Enable Transfer Call Tool</Label>
                                        <p className="text-xs text-muted-foreground">Agent can transfer mid-call.</p>
                                    </div>
                                    <Switch checked={enableTransferCall} onCheckedChange={setEnableTransferCall} />
                                </div>
                                <div className="flex items-center justify-between border rounded-lg p-4">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold">Enable End Call Tool</Label>
                                        <p className="text-xs text-muted-foreground">Agent can hang up.</p>
                                    </div>
                                    <Switch checked={enableEndCallTool} onCheckedChange={setEnableEndCallTool} />
                                </div>
                                <div className="flex items-center justify-between border rounded-lg p-4">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold">Enable DTMF Input</Label>
                                        <p className="text-xs text-muted-foreground">Capture keypad presses.</p>
                                    </div>
                                    <Switch checked={enableDtmfInput} onCheckedChange={setEnableDtmfInput} />
                                </div>
                                <div className="space-y-2 pt-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Data Collection Fields (CSV)</Label>
                                    <Input value={dataCollectionFields} onChange={e => setDataCollectionFields(e.target.value)} placeholder="email, phone, address" />
                                    <p className="text-[10px] text-muted-foreground">Information for the agent to extract and save.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 7: Guardrails */}
                    {currentStep === 7 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">7. Guardrails</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Off-topic Handling</Label>
                                    <Select value={offTopicHandling} onValueChange={setOffTopicHandling}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ignore">Ignore</SelectItem>
                                            <SelectItem value="redirect">Redirect</SelectItem>
                                            <SelectItem value="end_call">End Call</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">PII Collection Policy</Label>
                                    <Select value={piiPolicy} onValueChange={setPiiPolicy}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="allowed">Allowed</SelectItem>
                                            <SelectItem value="mask">Mask (Redact in logs)</SelectItem>
                                            <SelectItem value="forbidden">Forbidden</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {piiPolicy === 'mask' && (
                                        <p className="text-[10px] text-blue-500 font-medium mt-1">
                                            * Actual masking requires STT configuration in Workflow Settings
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Prohibited Topics (CSV)</Label>
                                    <Input value={prohibitedTopics} onChange={e => setProhibitedTopics(e.target.value)} placeholder="politics, religion, competitors" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Compliance Script (Read verbatim)</Label>
                                    <Textarea value={complianceScript} onChange={e => setComplianceScript(e.target.value)} placeholder="This call may be recorded..." />
                                </div>
                                <div className="flex justify-between items-center border rounded-lg p-4 md:col-span-2">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-semibold">Profanity Filter</Label>
                                        <p className="text-xs text-muted-foreground">Block explicit language.</p>
                                    </div>
                                    <Switch checked={profanityFilter} onCheckedChange={setProfanityFilter} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 8: Context Variables */}
                    {currentStep === 8 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">8. Context Variables</h2>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider">JSON Map</Label>
                                <Textarea 
                                    value={contextVariables} 
                                    onChange={e => {
                                        setContextVariables(e.target.value);
                                        if (e.target.value.includes('{{') || e.target.value.includes('}}')) {
                                            toast.error("Variable key cannot contain template syntax '{{' or '}}'");
                                        }
                                    }} 
                                    placeholder='{ "customer_name": "John Doe", "order_id": "12345" }' 
                                    className="font-mono min-h-[200px]"
                                />
                                <p className="text-[10px] text-muted-foreground">Pass custom data to your agent prompt. Keys must match /^[a-zA-Z_][a-zA-Z0-9_]*$/</p>
                                {contextVariables && (
                                    <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                                        <Label className="text-xs font-bold mb-2 block">Live Preview</Label>
                                        <pre className="text-xs font-mono overflow-auto text-muted-foreground">
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(contextVariables);
                                                    const keys = Object.keys(parsed);
                                                    if (keys.length > 20) return "Warning: Recommended maximum is 20 variables.";
                                                    return keys.map(k => `{{${k}}} → ${JSON.stringify(parsed[k])}`).join('\n');
                                                } catch {
                                                    return "Invalid JSON - please ensure it is properly formatted.";
                                                }
                                            })()}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 9: Domain Hints & Submit */}
                    {currentStep === 9 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold border-b pb-2">9. Domain Hints</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Industry</Label>
                                    <Select value={industry} onValueChange={setIndustry}>
                                        <SelectTrigger><SelectValue placeholder="Select industry..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="real_estate">Real Estate</SelectItem>
                                            <SelectItem value="healthcare">Healthcare</SelectItem>
                                            <SelectItem value="finance">Finance</SelectItem>
                                            <SelectItem value="saas_sales">SaaS / Sales</SelectItem>
                                            <SelectItem value="hr_recruiting">HR & Recruiting</SelectItem>
                                            <SelectItem value="e_commerce">E-Commerce</SelectItem>
                                            <SelectItem value="education">Education</SelectItem>
                                            <SelectItem value="insurance">Insurance</SelectItem>
                                            <SelectItem value="logistics">Logistics</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Target Audience</Label>
                                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="b2b">B2B</SelectItem>
                                            <SelectItem value="b2c">B2C</SelectItem>
                                            <SelectItem value="enterprise">Enterprise</SelectItem>
                                            <SelectItem value="smb">SMB</SelectItem>
                                            <SelectItem value="consumer">Consumer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider">Average Call Length</Label>
                                    <Select value={avgCallLength} onValueChange={setAvgCallLength}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="short">1–3 min</SelectItem>
                                            <SelectItem value="medium">3–7 min</SelectItem>
                                            <SelectItem value="long">7+ min</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex items-start space-x-3">
                                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                                <div>
                                    <h4 className="text-primary font-bold">Ready to Build</h4>
                                    <p className="text-xs mt-1 text-primary/80">
                                        Your voice agent will be generated and ready to test instantly. 
                                        You can adjust these settings later in the Workflow Dashboard.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
                                    <h4 className="font-bold">Error</h4>
                                    <p className="text-xs mt-1">{error}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-between pt-4">
                    <Button 
                        variant="outline" 
                        onClick={handlePrev} 
                        disabled={currentStep === 1 || isLoading}
                        className="w-[120px]"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    
                    {currentStep < 9 ? (
                        <Button 
                            onClick={handleNext} 
                            className="w-[120px]"
                        >
                            Next <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isLoading}
                            className="w-[140px] bg-primary"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Create Agent
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
