const Personality=require('./PersonalityEngine.cjs');
const Emotion=require('./EmotionEngine.cjs');
const Memory=require('./MemoryEngine.cjs');
const Relationship=require('./RelationshipEngine.cjs');
const Goal=require('./GoalEngine.cjs');
const Decision=require('./DecisionEngine.cjs');
const Reflection=require('./ReflectionEngine.cjs');
const Speech=require('./SpeechEngine.cjs');
const AdaptivePersonality=require('./AdaptivePersonalityEngine.cjs');
function prepare({text,emotion,relationship,memories,goals,preferences,permissions,traits,adaptiveTraits,adaptiveStyle,relevantMemories}={}){const relevant=Array.isArray(relevantMemories)?relevantMemories:Memory.retrieve(memories||[],text,12);const decision=Decision.decide({text,emotion,relationship,goals,permissions});const system=Personality.build({emotion,relationship,memories:relevant,goals,preferences,decision,traits:AdaptivePersonality.effectiveTraits(traits||Personality.traits,adaptiveTraits||{}),adaptiveStyle:adaptiveStyle||{}})+'\n\n'+Speech.buildGuidance({emotion,relationship,decision});return {relevant,decision,system};}
module.exports={prepare,Emotion,Memory,Relationship,Goal,Decision,Reflection,Speech,Personality,AdaptivePersonality};
