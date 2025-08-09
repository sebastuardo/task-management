import { Injectable } from "@nestjs/common";
import { TaskChanges, FieldChange } from "./dto/change-detection.dto";

@Injectable()
export class ActivityTrackerService {
  /**
   * Compara dos objetos de tarea y detecta los cambios
   */
  detectTaskChanges(oldTask: any, newTask: any): TaskChanges {
    const changes: TaskChanges = {};

    // Lista de campos que queremos trackear
    const trackedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "assigneeId",
    ];

    for (const field of trackedFields) {
      const oldValue = oldTask?.[field];
      const newValue = newTask?.[field];

      // Comparar valores, considerando null, undefined y diferentes tipos
      if (this.hasFieldChanged(oldValue, newValue)) {
        changes[field] = {
          old: this.normalizeValue(oldValue),
          new: this.normalizeValue(newValue),
        };
      }
    }

    // Trackear cambios en tags (array de IDs)
    if (this.hasTagsChanged(oldTask?.tags, newTask?.tags)) {
      changes.tags = {
        old: this.extractTagIds(oldTask?.tags),
        new: this.extractTagIds(newTask?.tags),
      };
    }

    return changes;
  }

  /**
   * Detecta cambios específicos para asignación de usuario
   */
  detectAssigneeChanges(
    oldAssigneeId: string | null,
    newAssigneeId: string | null
  ): TaskChanges {
    const changes: TaskChanges = {};

    if (this.hasFieldChanged(oldAssigneeId, newAssigneeId)) {
      changes.assigneeId = {
        old: oldAssigneeId,
        new: newAssigneeId,
      };
    }

    return changes;
  }

  /**
   * Compara si un campo específico ha cambiado
   */
  private hasFieldChanged(oldValue: any, newValue: any): boolean {
    // Normalizar valores para comparación
    const normalizedOld = this.normalizeValue(oldValue);
    const normalizedNew = this.normalizeValue(newValue);

    // Comparación profunda para fechas
    if (normalizedOld instanceof Date && normalizedNew instanceof Date) {
      return normalizedOld.getTime() !== normalizedNew.getTime();
    }

    return normalizedOld !== normalizedNew;
  }

  /**
   * Detecta cambios en arrays de tags
   */
  private hasTagsChanged(oldTags: any[], newTags: any[]): boolean {
    const oldIds = this.extractTagIds(oldTags).sort();
    const newIds = this.extractTagIds(newTags).sort();

    if (oldIds.length !== newIds.length) {
      return true;
    }

    return oldIds.some((id, index) => id !== newIds[index]);
  }

  /**
   * Extrae IDs de tags de un array de objetos tag
   */
  private extractTagIds(tags: any[]): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .map((tag) => (typeof tag === "string" ? tag : tag?.id))
      .filter(Boolean);
  }

  /**
   * Normaliza valores para comparación consistente
   */
  private normalizeValue(value: any): any {
    // Convertir undefined a null para consistencia
    if (value === undefined) {
      return null;
    }

    // Convertir string de fecha a objeto Date si es válido
    if (typeof value === "string" && this.isISODate(value)) {
      return new Date(value);
    }

    return value;
  }

  /**
   * Verifica si un string es una fecha ISO válida
   */
  private isISODate(str: string): boolean {
    try {
      const date = new Date(str);
      return date.toISOString() === str;
    } catch {
      return false;
    }
  }

  /**
   * Formatea cambios para mostrar de manera legible
   */
  formatChangesForDisplay(changes: TaskChanges): Record<string, FieldChange> {
    const formatted: Record<string, FieldChange> = {};

    for (const [field, change] of Object.entries(changes)) {
      formatted[field] = {
        old: this.formatValueForDisplay(change.old),
        new: this.formatValueForDisplay(change.new),
      };
    }

    return formatted;
  }

  /**
   * Formatea un valor individual para mostrar
   */
  private formatValueForDisplay(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value;
    }

    return value;
  }
}
