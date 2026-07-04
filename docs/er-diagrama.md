# Diagrama Entidad-Relación

Generado a partir del `schema.prisma` real del backend (`provider = "mysql"`). Refleja el modelo de datos vigente en producción, no un diseño preliminar.

## Contexto de volumen de datos

El sistema administra actualmente **48 iglesias reales** distribuidas en distritos, junto con sus pastores, líderes de ministerio y congregantes asociados. Es un volumen de datos pequeño y con crecimiento lento (altas y bajas administrativas, no tráfico transaccional), lo que respalda varias decisiones de arquitectura documentadas en los ADR (mantener todo en un único servidor MySQL compartido, no particionar ni tener réplicas, no necesitar caché distribuida).

## Diagrama

```mermaid
erDiagram
    DISTRITO ||--o{ IGLESIA : contiene
    MINISTERIO ||--o{ IGLESIA : "asociada a (opcional)"
    IGLESIA ||--o{ PASTOR : tiene
    IGLESIA ||--o{ LIDER : tiene
    IGLESIA ||--o{ CONGREGANTE : tiene
    CARGO ||--o{ PASTOR : clasifica
    MINISTERIO ||--o{ LIDER : agrupa
    SEXO ||--o{ CONGREGANTE : clasifica
    ESTADO_CIVIL ||--o{ CONGREGANTE : clasifica
    ESTADO_ECLESIAL ||--o{ CONGREGANTE : clasifica
    ROL ||--o{ USUARIO : asigna
    ESTADO_USUARIO ||--o{ USUARIO : asigna

    DISTRITO {
        int id PK
        string nombre UK
    }

    IGLESIA {
        int id PK
        string nombre
        text direccion "db.Text"
        longtext foto "db.LongText, base64, nullable"
        int distrito_id FK
        int ministerio_id FK "nullable"
        datetime created_at
        datetime updated_at
    }

    CARGO {
        int id PK
        string nombre UK
    }

    PASTOR {
        int id PK
        string nombre_pastor
        string celular "nullable"
        longtext foto "db.LongText, base64, nullable"
        int iglesia_id FK
        int cargo_id FK
        datetime created_at
        datetime updated_at
    }

    MINISTERIO {
        int id PK
        string nombre UK
        string slug UK "nullable"
        text descripcion "db.Text, nullable"
    }

    LIDER {
        int id PK
        char dni UK "8 caracteres"
        string nombre
        string apellido
        string telefono "nullable"
        string correo "nullable"
        int ministerio_id FK
        int iglesia_id FK
        datetime created_at
        datetime updated_at
    }

    CONGREGANTE {
        int id PK
        char dni UK "8 caracteres"
        string nombre
        string apellido
        string telefono "nullable"
        string correo "nullable"
        longtext foto "db.LongText, base64, nullable"
        int iglesia_id FK
        int sexo_id FK
        int estado_civil_id FK
        int estado_eclesial_id FK
        date fecha_conversion "nullable"
        date fecha_bautismo "nullable"
        datetime created_at
        datetime updated_at
    }

    EVENTO {
        int id PK
        string nombre
        datetime fecha_con_hora
        text ubicacion "db.Text, nullable"
        longtext imagen "db.LongText, base64, nullable"
        text descripcion "db.Text, nullable"
        datetime created_at
        datetime updated_at
    }

    COMUNICADO {
        int id PK
        string titulo
        longtext imagen "db.LongText, base64, nullable"
        text descripcion "db.Text, nullable"
        datetime created_at
        datetime updated_at
    }

    ROL {
        int id PK
        string nombre UK
    }

    ESTADO_USUARIO {
        int id PK
        string nombre UK
    }

    USUARIO {
        int id PK
        string nombre UK
        string email UK "nullable"
        string password_hash "bcryptjs"
        int rol_id FK
        int estado_id FK
        datetime created_at
        datetime updated_at
    }

    SEXO {
        int id PK
        string nombre UK
    }

    ESTADO_CIVIL {
        int id PK
        string nombre UK
    }

    ESTADO_ECLESIAL {
        int id PK
        string nombre UK
    }
```

## Notas sobre el mapeo a MySQL

Todos los modelos usan `@@map` a nombres de tabla en snake_case (p. ej. `Iglesia` → `iglesias`, `Congregante` → `congregantes`) y `@map` para columnas compuestas (`distritoId` → `distrito_id`). Los campos de texto largo (direcciones, descripciones, fotos e imágenes en base64) se marcan explícitamente con `@db.Text` o `@db.LongText` — el porqué de esa auditoría se explica en [ADR-002](adr/adr-002-mysql-vs-postgresql.md).
