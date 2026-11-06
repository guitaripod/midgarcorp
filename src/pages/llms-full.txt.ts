import type { APIRoute } from 'astro';
import { llmsSite, textHeaders } from '../lib/llms-site';
import { llmsFull } from '@utils/llms';

export const prerender = true;

export const GET: APIRoute = async () =>
  new Response(llmsFull(await llmsSite()), { headers: textHeaders });
