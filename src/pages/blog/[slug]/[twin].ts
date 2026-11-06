import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { markdownHeaders } from '../../../lib/llms-site';
import { MARKDOWN_TWIN, postMarkdown } from '@utils/llms';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () =>
  (await getCollection('blog'))
    .filter((post) => !post.data.draft)
    .map((post) => ({ params: { slug: post.slug, twin: MARKDOWN_TWIN }, props: { post } }));

export const GET: APIRoute = ({ props }) =>
  new Response(postMarkdown((props as { post: CollectionEntry<'blog'> }).post), {
    headers: markdownHeaders,
  });
