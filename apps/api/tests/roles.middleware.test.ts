import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type { Role } from "@reservalab/shared";
import { requireRoles } from "../src/middlewares/roles.middleware.js";

function probarPermiso(permitidos: Role[], rol?: Role) {
  const resultado = {
    status: 200,
    continua: false
  };

  const res = {
    locals: rol ? { user: { role: rol } } : {},
    status(codigo: number) {
      resultado.status = codigo;
      return this;
    },
    json() {
      return this;
    }
  };

  requireRoles(...permitidos)(
    {} as Request,
    res as unknown as Response,
    () => {
      resultado.continua = true;
    }
  );

  return resultado;
}

test("Sin sesion devuelve 401", () => {
  assert.deepEqual(probarPermiso(["administrador"]), {
    status: 401,
    continua: false
  });
});

const roles: Role[] = [
  "administrador",
  "docente",
  "estudiante"
];

for (const permitido of roles) {
  test(`Acceso exclusivo para ${permitido}`, () => {
    for (const rol of roles) {
      const autorizado = rol === permitido;

      assert.deepEqual(probarPermiso([permitido], rol), {
        status: autorizado ? 200 : 403,
        continua: autorizado
      });
    }
  });
}

test("Docente y administrador comparten un permiso", () => {
  for (const rol of roles) {
    const autorizado = rol !== "estudiante";

    assert.deepEqual(
      probarPermiso(["administrador", "docente"], rol),
      {
        status: autorizado ? 200 : 403,
        continua: autorizado
      }
    );
  }
});