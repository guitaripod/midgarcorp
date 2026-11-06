import type { APIRoute, GetStaticPaths } from 'astro';
import { landingApps, type LandingApp } from '@data/landing';
import { markdownHeaders } from '../../lib/llms-site';
import { MARKDOWN_TWIN, appMarkdown } from '@utils/llms';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () =>
  landingApps.map((app) => ({ params: { app: app.slug, twin: MARKDOWN_TWIN }, props: { app } }));

export const GET: APIRoute = ({ props }) =>
  new Response(appMarkdown((props as { app: LandingApp }).app), { headers: markdownHeaders });
