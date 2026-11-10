import { hash } from "bcryptjs";
import { db, pool } from "./client.js";
import { users, spaces } from "./schema.js";

async function seed(): Promise<void> {
  try {
    const password = "ReservaLab2026!";

    const demoUsers: (typeof users.$inferInsert)[] = [
      {
        name: "Administrador de prueba",
        email: "admin@reservalab.test",
        passwordHash: await hash(password, 12),
        role: "administrador"
      },
      {
        name: "Docente de prueba",
        email: "docente@reservalab.test",
        passwordHash: await hash(password, 12),
        role: "docente"
      },
      {
        name: "Estudiante de prueba",
        email: "estudiante@reservalab.test",
        passwordHash: await hash(password, 12),
        role: "estudiante"
      }
    ];

    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values(demoUsers)
        .onConflictDoNothing({ target: users.email });

      await tx
        .insert(spaces)
        .values([
          {
            id: "10000000-0000-4000-8000-000000000001",
            name: "Laboratorio de computacion 1",
            description: "Laboratorio con computadoras para practicas",
            location: "Edificio A, primer nivel",
            capacity: 25
          },
          {
            id: "10000000-0000-4000-8000-000000000002",
            name: "Laboratorio de redes",
            description: "Laboratorio para practicas de redes",
            location: "Edificio A, segundo nivel",
            capacity: 20
          },
          {
            id: "10000000-0000-4000-8000-000000000003",
            name: "Salon de clases 101",
            description: "Salon para clases y reuniones",
            location: "Edificio B, primer nivel",
            capacity: 40
          }
        ])
        .onConflictDoNothing({ target: spaces.id });
    });

    console.log("Datos de prueba cargados correctamente");
  } catch (error) {
    console.error("Error al cargar los datos de prueba:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();