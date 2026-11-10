import { sql } from "drizzle-orm";
import { db, pool } from "./client.js";

async function comprobarConexion(): Promise<void> {
  try {
    const resultado = await db.execute(sql`
      select current_database() as base_de_datos,
             current_user as usuario
    `);

    console.log("Conexion correcta con PostgreSQL");
    console.table(resultado.rows);
  } catch (error) {
    console.error("No se pudo conectar con PostgreSQL:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

comprobarConexion();