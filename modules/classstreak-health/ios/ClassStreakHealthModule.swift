import ExpoModulesCore
import HealthKit

public class ClassStreakHealthModule: Module {
 private let store = HKHealthStore()
 public func definition() -> ModuleDefinition {
  Name("ClassStreakHealth")
  Function("available") { HKHealthStore.isHealthDataAvailable() }
  AsyncFunction("authorize") { (promise: Promise) in
   guard HKHealthStore.isHealthDataAvailable() else { promise.resolve(false); return }
   self.store.requestAuthorization(toShare: [], read: [HKObjectType.workoutType()]) { success, error in
    if let error = error { promise.reject("HEALTH_PERMISSION", error.localizedDescription) } else { promise.resolve(success) }
   }
  }
  AsyncFunction("workouts") { (from: Double, until: Double, promise: Promise) in
   let beginning = Date(timeIntervalSince1970: max(from / 1000, Date().timeIntervalSince1970 - 31 * 86400))
   let end = Date(timeIntervalSince1970: min(until / 1000, Date().timeIntervalSince1970))
   let predicate = HKQuery.predicateForSamples(withStart: beginning, end: end, options: [])
   let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 1000, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
    if let error = error { promise.reject("HEALTH_READ", error.localizedDescription); return }
    let formatter = ISO8601DateFormatter()
    let records = (samples as? [HKWorkout] ?? []).map { workout in
     ["id": workout.uuid.uuidString, "started_at": formatter.string(from: workout.startDate), "ended_at": formatter.string(from: workout.endDate)]
    }
    promise.resolve(records)
   }
   self.store.execute(query)
  }
 }
}
