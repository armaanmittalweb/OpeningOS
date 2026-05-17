declare module 'fastify' {
  interface FastifyRequest { user?: { id: string; email: string; role?: string; sessionId?: string } }
  interface FastifyInstance { authenticate: any; requireAdmin: any }
}
export {};
