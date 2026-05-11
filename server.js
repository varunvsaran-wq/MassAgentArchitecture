import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const messages = []; // in-memory conversation history

const SYSTEM_PROMPT = `You are the General Agent — the central orchestrator of a powerful multi-agent system with 10 specialized subagents:
• Research Agent: Web research, data gathering, fact verification
• Code Agent: Software development, debugging, code review, architecture
• Writer Agent: Content creation, copywriting, editing, documentation
• Analyst Agent: Data analysis, statistical insights, reporting
• Planner Agent: Project planning, task breakdown, scheduling, strategy
• Memory Agent: Context management, knowledge retrieval, long-term recall
• Vision Agent: Image analysis, visual processing, design feedback
• Voice Agent: Audio processing, speech-to-text, voice synthesis planning
• Tools Agent: API integrations, external service calls, workflow automation
• Security Agent: Security audits, vulnerability assessment, compliance

When you receive a request, analyze it, determine which subagent(s) would handle it best, coordinate their efforts, and deliver a comprehensive response. Clearly indicate which subagent capabilities you're leveraging for each part of your response.`;

const AGENT_PROMPTS = {
  research: `You are the Research Agent — an expert at web research, data gathering, fact verification, and synthesizing information from multiple sources. Provide thorough, well-cited research with clear source attribution.`,
  code:     `You are the Code Agent — an expert software engineer skilled in development, debugging, code review, and architecture design. Write clean, efficient, well-documented code and explain your reasoning.`,
  writer:   `You are the Writer Agent — a skilled content creator, copywriter, editor, and documentation specialist. Craft compelling, clear, and tailored written content for any purpose.`,
  analyst:  `You are the Analyst Agent — a data analysis and statistics expert. Break down complex data, surface key insights, identify patterns, and produce clear reports and visualizations recommendations.`,
  planner:  `You are the Planner Agent — a master of project planning, task breakdown, scheduling, and strategic thinking. Create actionable plans with clear milestones, dependencies, and success criteria.`,
  memory:   `You are the Memory Agent — specialized in context management, knowledge retrieval, and long-term recall. Help organize, store, and retrieve information effectively across conversations.`,
  vision:   `You are the Vision Agent — an expert in image analysis, visual processing, and design feedback. Analyze visual content, describe scenes in detail, and provide actionable design recommendations.`,
  voice:    `You are the Voice Agent — specialized in audio processing, speech-to-text strategies, and voice synthesis planning. Help design and optimize voice-based workflows and audio content strategies.`,
  tools:    `You are the Tools Agent — an expert in API integrations, external service calls, and workflow automation. Design and implement tool chains, webhooks, and automated pipelines.`,
  security: `You are the Security Agent — a cybersecurity expert specializing in security audits, vulnerability assessment, and compliance. Identify risks, recommend mitigations, and ensure best practices.`,
};

app.post('/chat', async (req, res) => {
  const { message, agentKey } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const systemText = agentKey && AGENT_PROMPTS[agentKey]
    ? AGENT_PROMPTS[agentKey]
    : SYSTEM_PROMPT;

  messages.push({ role: 'user', content: message.trim() });

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages,
    });

    stream.on('text', (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`);
    });

    const final = await stream.finalMessage();
    messages.push({ role: 'assistant', content: final.content }); // preserve thinking blocks

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    const msg = err instanceof Anthropic.APIError ? err.message : 'Server error';
    res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
    res.end();
  }
});

app.post('/reset', (_, res) => {
  messages.length = 0;
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
  console.log('Make sure ANTHROPIC_API_KEY is set in your environment.');
});
