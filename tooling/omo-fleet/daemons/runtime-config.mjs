export const disabled = ['google','gemini','google-vertex','google-vertex-anthropic','antigravity'];
export function runtimeConfig(c) {
  const enabled = c.ollama?.enabled === true;
  const models=Object.fromEntries(['gpt-6.1-sol','gpt-6-astra'].map(id=>[id,{
    name:id,reasoning:true,limit:{context:200000,output:16000},options:{reasoningEffort:c.effort},
    variants:Object.fromEntries(['low','medium','high'].map(e=>[e,{reasoningEffort:e}]))
  }]));
  return {
    $schema:'https://opencode.ai/config.json',autoupdate:false,
    enabled_providers:enabled?['openai','ollama']:['openai'],
    disabled_providers:enabled?disabled:[...disabled,'ollama'],
    model:`${c.providerID}/${c.modelID}`,small_model:`openai/${c.modelID}`,
    permission:{'*':'deny',external_directory:'deny',read:{'*':'deny','workspace/antigravity-routing.md':'allow','workspace/vscode-settings.json':'allow'},glob:'deny',grep:'deny'},
    provider:{openai:{models},...(enabled?{ollama:{npm:'@ai-sdk/openai-compatible',name:'Ollama local',
      options:{baseURL:'http://host.docker.internal:11434/v1'},
      models:{[c.ollama.modelID]:{name:c.ollama.modelID,limit:{context:32000,output:4096}}}}}:{})}
  };
}
