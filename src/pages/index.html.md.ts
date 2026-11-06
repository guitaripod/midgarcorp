import type { APIRoute } from 'astro';
import { llmsSite, markdownHeaders } from '../lib/llms-site';
import { llmsIndex } from '@utils/llms';

export const prerender = true;

export const GET: APIRoute = async () =>
  new Response(llmsIndex(await llmsSite()), { headers: markdownHeaders });
