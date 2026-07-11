from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    margen_objetivo: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    ingredientes: Mapped[List["Ingrediente"]] = relationship(back_populates="categoria_rel")
    recetas: Mapped[List["Receta"]] = relationship(back_populates="categoria_rel")


class Ingrediente(Base):
    __tablename__ = "ingredientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria_id: Mapped[int] = mapped_column(Integer, ForeignKey("categorias.id"), nullable=False)
    unidad_compra: Mapped[str] = mapped_column(String(20), nullable=False)
    cantidad_compra: Mapped[float] = mapped_column(Float, nullable=False)
    precio_compra: Mapped[float] = mapped_column(Float, nullable=False)
    unidad_uso: Mapped[str] = mapped_column(String(20), nullable=False)
    merma_porcentaje: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    proveedor: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_actualizacion: Mapped[date] = mapped_column(Date, default=func.current_date())

    categoria_rel: Mapped["Categoria"] = relationship(back_populates="ingredientes")
    historial_precios: Mapped[List["HistorialPrecio"]] = relationship(
        back_populates="ingrediente_rel", cascade="all, delete-orphan"
    )
    lineas_receta: Mapped[List["LineaReceta"]] = relationship(
        back_populates="ingrediente_rel",
        foreign_keys="LineaReceta.ingrediente_id",
    )


class Receta(Base):
    __tablename__ = "recetas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria_id: Mapped[int] = mapped_column(Integer, ForeignKey("categorias.id"), nullable=False)
    porciones_por_lote: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    precio_venta: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    es_subreceta: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unidad_rendimiento: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    fecha_modificacion: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    categoria_rel: Mapped["Categoria"] = relationship(back_populates="recetas")
    lineas: Mapped[List["LineaReceta"]] = relationship(
        back_populates="receta_rel",
        cascade="all, delete-orphan",
        foreign_keys="LineaReceta.receta_id",
    )
    lineas_como_subreceta: Mapped[List["LineaReceta"]] = relationship(
        back_populates="subreceta_rel",
        foreign_keys="LineaReceta.subreceta_id",
    )


class LineaReceta(Base):
    __tablename__ = "lineas_receta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receta_id: Mapped[int] = mapped_column(Integer, ForeignKey("recetas.id"), nullable=False)
    ingrediente_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("ingredientes.id"), nullable=True)
    subreceta_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("recetas.id"), nullable=True)
    cantidad: Mapped[float] = mapped_column(Float, nullable=False)
    unidad: Mapped[str] = mapped_column(String(20), nullable=False)

    receta_rel: Mapped["Receta"] = relationship(
        back_populates="lineas", foreign_keys=[receta_id]
    )
    ingrediente_rel: Mapped[Optional["Ingrediente"]] = relationship(
        back_populates="lineas_receta", foreign_keys=[ingrediente_id]
    )
    subreceta_rel: Mapped[Optional["Receta"]] = relationship(
        back_populates="lineas_como_subreceta", foreign_keys=[subreceta_id]
    )


class HistorialPrecio(Base):
    __tablename__ = "historial_precios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ingrediente_id: Mapped[int] = mapped_column(Integer, ForeignKey("ingredientes.id"), nullable=False)
    precio_anterior: Mapped[float] = mapped_column(Float, nullable=False)
    precio_nuevo: Mapped[float] = mapped_column(Float, nullable=False)
    fecha_cambio: Mapped[date] = mapped_column(Date, default=func.current_date())

    ingrediente_rel: Mapped["Ingrediente"] = relationship(back_populates="historial_precios")
